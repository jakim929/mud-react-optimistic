// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {Tasks, TasksData} from "../codegen/index.sol";

contract TasksSystem is System {
    function addTask(string memory description) public returns (bytes32 id) {
        id = keccak256(abi.encode(block.prevrandao, _msgSender(), description));
        Tasks.set(id, TasksData({description: description, createdAt: block.timestamp, completedAt: 0}));
    }

    function completeTask(bytes32 id) public {
        Tasks.setCompletedAt(id, block.timestamp);
    }

    function resetTask(bytes32 id) public {
        Tasks.setCompletedAt(id, 0);
    }

    function deleteTask(bytes32 id) public {
        Tasks.deleteRecord(id);
    }

    function appendToTaskDescription(bytes32 id, string memory additionalDescription) public {
        // Read the existing task data
        TasksData memory task = Tasks.get(id);

        // Append the new description to the existing one
        task.description = string(abi.encodePacked(task.description, additionalDescription));

        // Update the task record with the new description
        Tasks.set(id, task);
    }
}
