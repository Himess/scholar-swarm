// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";

import {ArtifactRegistry} from "../src/ArtifactRegistry.sol";
import {IArtifactRegistry} from "../src/interfaces/IArtifactRegistry.sol";

contract ArtifactRegistryTest is Test {
    ArtifactRegistry reg;

    function setUp() public {
        reg = new ArtifactRegistry();
    }

    function test_anchor_storesAndEmits() public {
        bytes32 root = keccak256("findings-1");
        vm.expectEmit(true, true, true, true);
        emit IArtifactRegistry.ArtifactAnchored(
            42, 0, IArtifactRegistry.ArtifactKind.SubTaskFindings, root, 7, address(this)
        );
        reg.anchor(42, 0, IArtifactRegistry.ArtifactKind.SubTaskFindings, root, 7);

        assertEq(reg.getRoot(42, 0, IArtifactRegistry.ArtifactKind.SubTaskFindings), root);
    }

    function test_anchor_revertsOnDoubleAnchor() public {
        bytes32 root = keccak256("findings-1");
        reg.anchor(42, 0, IArtifactRegistry.ArtifactKind.SubTaskFindings, root, 7);
        vm.expectRevert(ArtifactRegistry.AlreadyAnchored.selector);
        reg.anchor(42, 0, IArtifactRegistry.ArtifactKind.SubTaskFindings, root, 7);
    }

    function test_anchor_revertsOnEmptyRoot() public {
        vm.expectRevert(IArtifactRegistry.EmptyRoot.selector);
        reg.anchor(42, 0, IArtifactRegistry.ArtifactKind.FinalReport, bytes32(0), 7);
    }

    function test_getAllForBounty_returnsAll() public {
        reg.anchor(1, 0, IArtifactRegistry.ArtifactKind.SubTaskFindings, keccak256("a"), 10);
        reg.anchor(1, 1, IArtifactRegistry.ArtifactKind.SubTaskFindings, keccak256("b"), 11);
        reg.anchor(1, 0, IArtifactRegistry.ArtifactKind.CriticRationale, keccak256("c"), 12);

        (uint8[] memory ix, IArtifactRegistry.ArtifactKind[] memory kinds, bytes32[] memory roots) =
            reg.getAllForBounty(1);
        assertEq(ix.length, 3);
        assertEq(roots[0], keccak256("a"));
        assertEq(roots[1], keccak256("b"));
        assertEq(roots[2], keccak256("c"));
        assertEq(uint256(kinds[2]), uint256(IArtifactRegistry.ArtifactKind.CriticRationale));
    }
}
