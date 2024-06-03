---
title: LayerZero 跨链通信转账 2024极简示例
date: 2024-03-03 22:58:02
tags: 
- solidity
categories: solidity
mathjax: true
description: 一个layerzero的极简示例
---

## 开篇

由于在站内看到了2022年layerzero极简教程，但是由于layerzero版本更迭，其官方示例的封装性高又缺乏注解，故写了这篇2024版layerzero示例。

本示例包含fantom testnet 跨链传递信息或native token至mumbai network的合约与脚本，希望能帮到诸位。




## 初始化项目

我们可以使用hardhat很轻松地创建一个solidity合约项目：

```shell
mkdir layerzero-tutorial

cd layerzero-tutorial

npm init

npm install --save-dev hardhat

npx hardhat init
```

最后一项选择创建一个ts项目

```
👷 Welcome to Hardhat v2.20.1 👷‍

? What do you want to do? …

  Create a JavaScript project

  Create a TypeScript project

 ❯ Create a TypeScript project (with Viem)

  Create an empty hardhat.config.js

  Quit
```



## 编写合约

我们期待从A链发送信息或者代币至B链，需要在A/B两条链上分别部署合约，如果你的操作是对称的，即相同业务的双向通信，则可以使用同一张合约，本示例的合约也只有一张，分别部署至 fantom testnet 和 mumbai。

下面是合约代码：

```javascript
//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
pragma abicoder v2;

import "../interfaces/ILayerZeroEndpoint.sol";
import "../interfaces/ILayerZeroReceiver.sol";
import "hardhat/console.sol";

contract LayerZeroDemo1 is ILayerZeroReceiver {
    event ReceiveMsg(
        uint16 _srcChainId,
        address _from,
        uint16 _count,
        bytes _payload
    );
    ILayerZeroEndpoint public endpoint;
    uint16 public messageCount;
    bytes public message;

    constructor(address _endpoint) {
        endpoint = ILayerZeroEndpoint(_endpoint);
    }
    
    function sendMsg(
        uint16 _dstChainId,
        address _destination,
        bytes calldata payload,
        bytes calldata _adapterParams
    ) public payable {
        require(abi.encodePacked(_destination,address(this)).length == 40, "Invalid destination");
        endpoint.send{value: msg.value}(
            _dstChainId,
            abi.encodePacked(_destination,address(this)),
            payload,
            payable(msg.sender),
            address(this),
            _adapterParams
        );
    }

    function sendNativeToken(
        uint16  _dstChainId, 
        address  _toAddress, 
        uint  _amount
    ) public payable {
        uint dstGas = 350000;
        uint16 version = 2;
        bytes memory adapterParams = abi.encodePacked(version, dstGas, _amount, _toAddress);
        bytes memory payload = abi.encode(_amount, msg.sender, _toAddress);
        //_lzSend(_dstChainId[i], payload, refundAddress, _zroPaymentAddress, adapterParams, address(this).balance);
        endpoint.send{value: msg.value}(
            _dstChainId,
            abi.encodePacked(_toAddress,address(this)),
            payload,
            payable(msg.sender),
            address(this),
            adapterParams
        );

    }
    
    function lzReceive(
        uint16 _srcChainId,
        bytes memory _from,
        uint64,
        bytes memory _payload
    ) external override {
        require(msg.sender == address(endpoint));
        address from;
        assembly {
            from := mload(add(_from, 20))
        }
        if (
            keccak256(abi.encodePacked((_payload))) ==
            keccak256(abi.encodePacked((bytes10("ff"))))
        ) {
            endpoint.receivePayload(
                1,
                bytes(""),
                address(0x0),
                1,
                1,
                bytes("")
            );
        }
        message = _payload;
        messageCount += 1;
        emit ReceiveMsg(_srcChainId, from, messageCount, message);
    }
    
    // Endpoint.sol estimateFees() returns the fees for the message
    function estimateFees(
        uint16 _dstChainId,
        address _userApplication,
        bytes calldata _payload,
        bool _payInZRO,
        bytes calldata _adapterParams
    ) external view returns (uint256 nativeFee, uint256 zroFee) {
        return
            endpoint.estimateFees(
                _dstChainId,
                _userApplication,
                _payload,
                _payInZRO,
                _adapterParams
            );
    }

    receive() external payable {
    }
}
```



接下来我会讲解这份合约：

**首先是引用的几个接口：**

```javascript
import "../interfaces/ILayerZeroEndpoint.sol";
import "../interfaces/ILayerZeroReceiver.sol";
```

这两个接口由LayerZero项目方提供，实现 ILayerZeroEndpoint 的 endpoint 合约与我们自己的业务合约直接对接，是我们使用LayerZero进行跨链操作的入口合约，而ILayerZeroReceiver 规定了一些标准使得我们处于目标链的合约可以接收到来自 LayerZero 桥的信息。

**之后我们在构造函数中存储endpoint的地址**，每条链上的endpoint地址都有不同，可以查询LayerZero官方文档：
[文档](https://layerzero.gitbook.io/docs/technical-reference/testnet/testnet-addresses)

```java
    constructor(address _endpoint) {
        endpoint = ILayerZeroEndpoint(_endpoint);
    }
```

**我们再来写消息传递方法：**

```
    function sendMsg(
        uint16 _dstChainId,
        address _destination,
        bytes calldata payload,
        bytes calldata _adapterParams
    ) public payable {
        require(abi.encodePacked(_destination,address(this)).length == 40, "Invalid destination");
        endpoint.send{value: msg.value}(
            _dstChainId,
            abi.encodePacked(_destination,address(this)),
            payload,
            payable(msg.sender),
            address(this),
            _adapterParams
        );
    }
```

这里我们可以看到一些意义不明的参数，由于业务代码可以随意设置，我们直接解释endpoint的send方法，_dstChainId 是目标链的id，注意不是我们区块链意义的chainId，而是目标链上的endpoint的ID，例如mumbai 的chain id是80001，mumbai上endpoint的id是10109,如果我们是想跨到mumbai，那这第一个参数应该写 10109。第二个参数名为 path,它是由目标合约和本业务合约 encodePacket形成的，第三个参数payload 和 第四个参数payloadAddress,分别是需要传递的信息和收退款的地址，这里我们设置为发送者本人了。第五个参数是给layerzero交手续费的地址，这里我们设置成合约本身。而最后一个adapterParams代表了对这次交易的gas设置和native token 处理方式，我会在下一个章节详细说明。

类似的我们也可以写出带有nativetoken 传递的方法，需要说明的是，上边的sendMsg本质上也可以通过手动构造adapterParams来实现这个类型的交易，我选择只是想使用sendNativeToken做例子说明在大多数的业务场景里，adapterParams在合约encode里更加便利一些。

```
    function sendNativeToken(
        uint16  _dstChainId, 
        address  _toAddress, 
        uint  _amount
    ) public payable {
        uint dstGas = 350000;
        uint16 version = 2;
        bytes memory adapterParams = abi.encodePacked(version, dstGas, _amount, _toAddress);
        bytes memory payload = abi.encode(_amount, msg.sender, _toAddress);
        //_lzSend(_dstChainId[i], payload, refundAddress, _zroPaymentAddress, adapterParams, address(this).balance);
        endpoint.send{value: msg.value}(
            _dstChainId,
            abi.encodePacked(_toAddress,address(this)),
            payload,
            payable(msg.sender),
            address(this),
            adapterParams
        );

    }
```

其实和sendMsg差不多，只是我们在合约里给 adapterParams 赋了值。

adapterParams的格式被按照交易类型分为两种：

第一种是不给目标合约发送原生代币，它的adapterParams格式为：
    // txType 1
    // bytes  [2       32      ]
    // fields [txType  extraGas]
总共34 byte，依次是交易类型，目标链gaslimit
第二种是给目标合约发送原生代币，它的adapterParams格式为：
    // txType 2
    // bytes  [2       32        32            bytes[]         ]
    // fields [txType  extraGas  dstNativeAmt  dstNativeAddress]
    // User App Address is not used in this version

依次是  交易类型，目标链gaslimit，发送代币数目，目标地址

所以我们的adapterParams构建为：

```javascript
        uint dstGas = 350000;
        uint16 version = 2;
        bytes memory adapterParams = abi.encodePacked(version, dstGas, _amount, _toAddress);
```





## 编写部署脚本

我们的部署脚本其实是一模一样的，只是部署参数中的endpoint地址不同而已：

Fantom testnet:

```typescript
async function main() {
  const LayerZeroDemo1 = await ethers.getContractFactory("LayerZeroDemo1");
  const layerZeroDemo1 = await LayerZeroDemo1.deploy(
    "0x7dcAD72640F835B0FA36EFD3D6d3ec902C7E5acf"
  );
  await layerZeroDemo1.waitForDeployment();
  console.log("layerZeroDemo1 deployed to:", await layerZeroDemo1.getAddress(),"on Fantom Testnet.");
}
/*
```



Mumbai :

```typescript
async function main() {
  const LayerZeroDemo1 = await ethers.getContractFactory("LayerZeroDemo1");
  const layerZeroDemo1 = await LayerZeroDemo1.deploy(
    "0xf69186dfBa60DdB133E91E9A4B5673624293d8F8"
  );
  await layerZeroDemo1.waitForDeployment();
  console.log("layerZeroDemo1 deployed to:", await layerZeroDemo1.getAddress(), " on Mumbai Testnet.");
}
```



我们便可以得到fantomtestnet 和 mumbai 上的合约：

fantomtestnet:*0xd79b3438968FB409340c9fd405109258C458C5F7*

mumbai:*0x55DD4f23aFA85305f8C7DCa8a9F86D0d0a5aE8Cd*

## 编写测试脚本

现在我们开始调用fantomtestnet 的合约：

### sendMsg方法：

```typescript
async function main() {
  const layerZeroDemo1 = await ethers.getContractAt("LayerZeroDemo1", "0xd79b3438968FB409340c9fd405109258C458C5F7");
  const transaction = await layerZeroDemo1.sendMsg(
    10109,
    "0x55DD4f23aFA85305f8C7DCa8a9F86D0d0a5aE8Cd",
    ethers.encodeBytes32String("Hello LayerZero1"),
    "0x00010000000000000000000000000000000000000000000000000000000001111111",
    { value: ethers.parseEther("1") }
  );
    console.log(transaction.hash);
}
```

这里值得一说的实际上只有 adapterparams, "0001"为transaction type,"0000000000000000000000000000000000000000000000000000000001111111"为gasLimit。而我们传入的 value，1个ftm会在扣除掉gas fee后还给我们。



### sendNativeToken方法：

```typescript
async function sendNativeToken(){
    const layerZeroDemo1 = await ethers.getContractAt("LayerZeroDemo1", "0xd79b3438968FB409340c9fd405109258C458C5F7");
    const transaction = await layerZeroDemo1.sendNativeToken(
        10109, 
        "0x55DD4f23aFA85305f8C7DCa8a9F86D0d0a5aE8Cd",
        100,
        { value: ethers.parseEther("1")}
    )
    console.log(transaction.hash);
}

```



## 检查方法：



我们可以在layerzero scan查看交易的情况：
[浏览器](https://layerzeroscan.com/)

![](2gz1RRm265e48eb67cf16.webp '浏览器截图')