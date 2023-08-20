---
title: solidity journey day1
date: 2022-12-20 23:28:48
tags: 
- solidity
- chainlink
categories: solidity
mathjax: true
description: A learning note of deploying/testing contract by using hardhat and using vrf service.
---


I'm starting learning solidity today and create a simple contract using hardhat and chainlink VRF. I will continue to upgrade it in the days to come as I learn more deeper.

Completed the following functions today:

1. Deploy contract to Goerli TestNet by hardhat framework.
2. Interact with the contract by hardhat framework.
3. Implement a simple gambling function using VRF in the contract.

 learning notes:

1.Basic Contract

Note:

1. The `address` and `address payable` types both store a 160-bit Ethereum address. The concept of payable and non-payable addresses only exists in the Solidity type system at compile-time. The difference between payable and non-payable addresses is gone in the compiled contract code. You can use `payable(address)` to convert `address` to `payable address`.
2. Use `new CpntractFactory(cantractAddress)` to create a new contract in this contract.
3. The `A.transfer(value)` function is used to transfer ether to address A from this contract. The keyword `payable` allowed transferring ether to someone or receiving ether.

```solidity
pragma solidity ^0.8.9;

import "./VRFv2Consumer.sol";


contract lottery {
    event Received(address caller,uint amount,string message);

    address payable public owner;

    VRFv2Consumer VRF;

    constructor(uint64 subscriptionId) payable {
        owner =payable(msg.sender);
        VRF =new VRFv2Consumer(subscriptionId);
    }

    function Owner()public view returns (address) {
        return owner;
    }

    function Balance()public view returns (uint256) {
        return address(this).balance;
    }

    function VRFAddress()public view returns (address) {
        return address(VRF);
    }

    function buy_lottery() payable external returns (uint256) {
        uint256 value = msg.value;
        uint random = 5 + VRF.requestRandomWords()%10;
        uint256 lottery_value =  (value * random) /10;
        
        payable(msg.sender).transfer(lottery_value);
        return lottery_value;
    }

    function withdraw_lottery() external {
        owner.transfer(address(this).balance);
    }

    receive() external payable{
        emit Received(msg.sender, msg.value,"receive was called");
    }

}
```



2.VRFConsumercontract

Note:

VRF is a random number supplier in chainlink. We can deploy a VRFConsumer contract and register it in your Subscription Manager(require LINK token). The owner of VRFConsumer can get random numbers so we should deploy it by basic contract instead of the EOF account.

```solidity
// SPDX-License-Identifier: MIT
// An example of a consumer contract that relies on a subscription for funding.
pragma solidity ^0.8.9;

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/ConfirmedOwner.sol";

contract VRFv2Consumer is VRFConsumerBaseV2, ConfirmedOwner {
    event RequestSent(uint256 requestId, uint32 numWords);
    event RequestFulfilled(uint256 requestId, uint256[] randomWords);

    struct RequestStatus {
        bool fulfilled; // whether the request has been successfully fulfilled
        bool exists; // whether a requestId exists
        uint256[] randomWords;
    }
    mapping(uint256 => RequestStatus)
        public s_requests; /* requestId --> requestStatus */
    VRFCoordinatorV2Interface COORDINATOR;

    // Your subscription ID.
    uint64 s_subscriptionId;

    // past requests Id.
    uint256[] public requestIds;
    uint256 public lastRequestId;

    bytes32 keyHash =
        0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15;

    uint32 callbackGasLimit = 100000;

    // The default is 3, but you can set this higher.
    uint16 requestConfirmations = 3;

    // For this example, retrieve 2 random values in one request.
    // Cannot exceed VRFCoordinatorV2.MAX_NUM_WORDS.
    uint32 numWords = 2;

    /**
     * HARDCODED FOR GOERLI
     * COORDINATOR: 0x2Ca8E0C643bDe4C2E08ab1fA0da3401AdAD7734D
     */
    constructor(
        uint64 subscriptionId
    )
        VRFConsumerBaseV2(0x2Ca8E0C643bDe4C2E08ab1fA0da3401AdAD7734D)
        ConfirmedOwner(msg.sender)
    {
        COORDINATOR = VRFCoordinatorV2Interface(
            0x2Ca8E0C643bDe4C2E08ab1fA0da3401AdAD7734D
        );
        s_subscriptionId = subscriptionId;
    }

    // Assumes the subscription is funded sufficiently.
    function requestRandomWords()
        external
        onlyOwner
        returns (uint256 requestId)
    {
        // Will revert if subscription is not set and funded.
        requestId = COORDINATOR.requestRandomWords(
            keyHash,
            s_subscriptionId,
            requestConfirmations,
            callbackGasLimit,
            numWords
        );
        s_requests[requestId] = RequestStatus({
            randomWords: new uint256[](0),
            exists: true,
            fulfilled: false
        });
        requestIds.push(requestId);
        lastRequestId = requestId;
        emit RequestSent(requestId, numWords);
        return requestId;
    }

    function fulfillRandomWords(
        uint256 _requestId,
        uint256[] memory _randomWords
    ) internal override {
        require(s_requests[_requestId].exists, "request not found");
        s_requests[_requestId].fulfilled = true;
        s_requests[_requestId].randomWords = _randomWords;
        emit RequestFulfilled(_requestId, _randomWords);
    }

    function getRequestStatus(
        uint256 _requestId
    ) external view returns (bool fulfilled, uint256[] memory randomWords) {
        require(s_requests[_requestId].exists, "request not found");
        RequestStatus memory request = s_requests[_requestId];
        return (request.fulfilled, request.randomWords);
    }
}

```

3.Hardhat Framework

Add network settings in hardhat.config.js:

```javascript
require("@nomicfoundation/hardhat-toolbox");

const ALCHEMY_API_KEY = "...";
const GOERLI_PRIVATE_KEY =
  "...";

module.exports = {
  solidity: "0.8.9",
  networks: {
    goerli: {
      url: `https://eth-goerli.alchemyapi.io/v2/${ALCHEMY_API_KEY}`,
      accounts: [GOERLI_PRIVATE_KEY],
    },
  },
};

```

Deploy script:

```solidity
async function main() {
  const Lottery = await ethers.getContractFactory("lottery");
  const lottery = await Lottery.deploy(4038, {
    value: 100000,
  });
  console.log("Lottery deployed to:", lottery.address);
  console.log("VRF deployed to:", await lottery.VRFAddress());
}

```

Interact with deployed contract:

```javascript
async function main() {
  const LotteryAddress = "0x63219Df994Bb37307dEdbE6Cdf9a8A71b45Dcf4b";
  const lottery = await ethers.getContractAt("lottery", LotteryAddress);
  const reback_value = await lottery.buy_lottery({ value: 10 });
  console.log(reback_value);
}

```

We can also set sender.value and gas limit in deploy or other functions.