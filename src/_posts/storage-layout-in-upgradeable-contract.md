---
title: 可升级合约中的存储区问题
date: 2024-04-01 15:55:48
tags: 
- solidity
categories: solidity
mathjax: true
description: 使用指定slot解决可升级合约中的存储区冲突问题
---




可升级合约的原理听起来很简单，我们在可升级合约中采取 Proxy 合约存储数据，implement 合约存储代码，就可以实现在保证存储区不变的情况下更新代码，但是如果想保证我们的存储区的安全，非得对合约存储区有一定认识才可以。

我们可以从这两个实现合约入手：



```
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
abstract contract V1{
    uint public a;
    uint public b;

    function setA(uint a_) public {
        a = a_;
    }
    
    function setB(uint b_) public {
        b = b_;
    }

    function result() public view returns(uint){
        return a+b;
    }
    
}
```



```
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
abstract contract V2{
    uint public b;
    uint public a;

    function setA(uint a_) public {
        a = a_;
    }
    
    function setB(uint b_) public {
        b = b_;
    }

    function result() public view returns(uint){
        return a*b;
    }
    
}
```

我们可以看出，除了将 `function result() public view returns(uint)` 的实现改变之外，变量 `a` 和变量 `b` 的位置也发生了变化，这会导致一个问题，代理合约中的插槽 0 在第一版中是变量 `a` ， 而在第二版中是变量 `b` ，很多情况下这会导致存储和逻辑的代码出现冲突，在一些开发框架下，出现存储区冲突的升级会报错，而大多数情况我们都要保证一条，那就是"新实现的变量一定要写在所有原有变量之后。" (`constant` 变量除外 , 它们直接硬编码进code , 不占用存储区)。



在有合约继承的情况下，编译器会将所有的父合约和当前合约写在同一张合约里，其存储区也当然是通用的，而存储区的排列是：父合约1，父合约2，... ，当前合约。以下面的合约为例：

```
pragma solidity ^0.8.0;
import './Extend2.sol';
import './Extend1.sol';

contract Test is  Extend1 ,Extend2 {
   address public a;
   uint256 public u;
   uint256 public balance;

}
abstract contract Extend1{
    address internal  _e1;
}
abstract contract Extend2{
    address internal _e2;
}

```

父合约的顺序由合约声明时的顺序决定，`contract Test is  Extend1 ,Extend2` 中 `Extend1` 就在 `Extend2`之前，那么在这个合约中，存储区先分配 `Extend1` 中的变量，然后是 `Extend2` ,然后是 `Test` 合约。那么插槽0 即表示 `_e1`,插槽1 表示 `_e2`,插槽2 为  `a`。



既然父合约的变量一定会排在实现合约之前，那么是不是表示一旦加入了新的父合约，实现合约的存储区就会发生冲突呢？我们似乎在开发中很少遇到这种冲突情况，因为`openzepplin`提供了大多数基础合约的可升级版本，他们在所有的可升级合约中都没有显式声明任何非`constant`变量，而是通过直接指定插槽的方式进行存储和查询。

```javascript
// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (access/Ownable.sol)

pragma solidity ^0.8.20;

import {ContextUpgradeable} from "../utils/ContextUpgradeable.sol";
import {Initializable} from "../proxy/utils/Initializable.sol";

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * The initial owner is set to the address provided by the deployer. This can
 * later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract OwnableUpgradeable is Initializable, ContextUpgradeable {
    /// @custom:storage-location erc7201:openzeppelin.storage.Ownable
    struct OwnableStorage {
        address _owner;
    }

    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.Ownable")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant OwnableStorageLocation = 0x9016d09d72d40fdae2fd8ceac6b6234c7706214fd39c1cd1e609a0528c199300;

    function _getOwnableStorage() private pure returns (OwnableStorage storage $) {
        assembly {
            $.slot := OwnableStorageLocation
        }
    }

    /**
     * @dev The caller account is not authorized to perform an operation.
     */
    error OwnableUnauthorizedAccount(address account);

    /**
     * @dev The owner is not a valid owner account. (eg. `address(0)`)
     */
    error OwnableInvalidOwner(address owner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the address provided by the deployer as the initial owner.
     */
    function __Ownable_init(address initialOwner) internal onlyInitializing {
        __Ownable_init_unchained(initialOwner);
    }

    function __Ownable_init_unchained(address initialOwner) internal onlyInitializing {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        OwnableStorage storage $ = _getOwnableStorage();
        return $._owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        OwnableStorage storage $ = _getOwnableStorage();
        address oldOwner = $._owner;
        $._owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}
```



我们可以看到这个我们经常使用的可升级合约合约，把该合约用到的数值打包进一个结构体，之后指定了一个 slot 进行存储，而不是让编译器自行安排，这样当我们添加或者删除这段代码后，合约的存储区不会由于错位导致冲突。



对于这种指定存储区的写法我们可以直接参考 `StorageSlot.sol` :



```javascript
library StorageSlot {
    struct AddressSlot {
        address value;
    }

    struct BooleanSlot {
        bool value;
    }

    struct Bytes32Slot {
        bytes32 value;
    }

    struct Uint256Slot {
        uint256 value;
    }

    struct Int256Slot {
        int256 value;
    }

    struct StringSlot {
        string value;
    }

    struct BytesSlot {
        bytes value;
    }

    /**
     * @dev Returns an `AddressSlot` with member `value` located at `slot`.
     */
    function getAddressSlot(bytes32 slot) internal pure returns (AddressSlot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `BooleanSlot` with member `value` located at `slot`.
     */
    function getBooleanSlot(bytes32 slot) internal pure returns (BooleanSlot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `Bytes32Slot` with member `value` located at `slot`.
     */
    function getBytes32Slot(bytes32 slot) internal pure returns (Bytes32Slot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `Uint256Slot` with member `value` located at `slot`.
     */
    function getUint256Slot(bytes32 slot) internal pure returns (Uint256Slot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `Int256Slot` with member `value` located at `slot`.
     */
    function getInt256Slot(bytes32 slot) internal pure returns (Int256Slot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `StringSlot` with member `value` located at `slot`.
     */
    function getStringSlot(bytes32 slot) internal pure returns (StringSlot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `StringSlot` representation of the string storage pointer `store`.
     */
    function getStringSlot(string storage store) internal pure returns (StringSlot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := store.slot
        }
    }

    /**
     * @dev Returns an `BytesSlot` with member `value` located at `slot`.
     */
    function getBytesSlot(bytes32 slot) internal pure returns (BytesSlot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `BytesSlot` representation of the bytes storage pointer `store`.
     */
    function getBytesSlot(bytes storage store) internal pure returns (BytesSlot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := store.slot
        }
    }
}
```

当我们需要声明一个变量时，可以直接使用一个 `constant` 变量来标记变量，而非直接生命变量：

```javascript
 bytes32 internal constant _U_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbb;
```



需要写入数据，则使用：

```javascript
    function setU(uint256 u_) public {
        StorageSlot.getUint256Slot(_U_SLOT).value = u_;
   }
```

需要读取数据，就可以使用：

```javascript
   function getUSlot() public view returns (uint256) {
    return StorageSlot.getUint256Slot(_U_SLOT).value;
   }
   
```

这样就可以保证我们的变量不再受声明顺序的影响了。

总结一下，当开发可升级合约时，我们需要注意每次更新时的存储位置不发生冲突，在这个基础上，如果需要继承他人的代码库，需要确保他人的代码库也是可升级的。