---
title: Go-ethereum code walkthrough Day 1
date: 2024-06-12 12:02:05
tags: ethereum
mathjax: true
categories: ethereum
description: ethereum source code analysis
---


I will read the source code of `go-ethereum ` and record this journey. Due to most of what I know about Ethereum is from building Dapp with Solidity, I prefer to start with the `vm` package.



The entry file is `evm.go`. 

## Call , StaticCall and DelegateCall

There are 4 method for executing the contract which are called `Call`,`StaticCall`,`CallCode` and `DelegateCall`. The differences between them is the execution environment (msg.sender,storage and code) .

We can dive into the implement of them except `CallCode` which is deprecated. `StaticCall` is the only readonly method and it is also the method used for `view` and `pure` function in Solidity. The storage will not be changed during `StaticCall` executing.

 `DelegateCall` differs from `Call` in the sense that it executes the given address code with the caller as context. EVM will generate a temporary contract instance with a chosen address and a chosen code. The storage of this address is the context in which the code runs.

Look at the code:

```go
func (evm *EVM) Call(caller ContractRef, addr common.Address, input []byte, gas uint64, value *uint256.Int) (ret []byte, leftOverGas uint64, err error) {
	............
  ............
  		code := evm.StateDB.GetCode(addr)
			addrCopy := addr
  
			// If the account has no code, we can abort here
			// The depth-check is already done, and precompiles handled above
			contract := NewContract(caller, AccountRef(addrCopy), value, gas)
			contract.SetCallCode(&addrCopy, evm.StateDB.GetCodeHash(addrCopy), code)
			ret, err = evm.interpreter.Run(contract, input, false)
			gas = contract.Gas
	............
  ............
	return ret, gas, err
}

```

 

```go
func (evm *EVM) DelegateCall(caller ContractRef, addr common.Address, input []byte, gas uint64) (ret []byte, leftOverGas uint64, err error) {
	............
  ............
		addrCopy := addr
		// Initialise a new contract and make initialise the delegate values
		contract := NewContract(caller, AccountRef(caller.Address()), nil, gas).AsDelegate()
		contract.SetCallCode(&addrCopy, evm.StateDB.GetCodeHash(addrCopy), evm.StateDB.GetCode(addrCopy))
		ret, err = evm.interpreter.Run(contract, input, false)
		gas = contract.Gas
	............
  ............
}

```

We can find the difference easily that is the parameter of constructor `NewContract`. The first uses the target address and the second uses the caller's address.

And the `StaticCall` :

```go
func (evm *EVM) StaticCall(caller ContractRef, addr common.Address, input []byte, gas uint64) (ret []byte, leftOverGas uint64, err error) {
	............
  ............
		ret, err = evm.interpreter.Run(contract, input, true)// readOnly
  ............
  ............

}
```

## Create and Create2

`Create` and `Create2` are basically same except calculating contract's address.

In `Create`, the address of new contract depends on the caller and it's nonce. 

In `Create2`, it depends on the caller, salt and code.

```go
func (evm *EVM) Create(caller ContractRef, code []byte, gas uint64, value *uint256.Int) (ret []byte, contractAddr common.Address, leftOverGas uint64, err error) {
	contractAddr = crypto.CreateAddress(caller.Address(), evm.StateDB.GetNonce(caller.Address()))
	return evm.create(caller, &codeAndHash{code: code}, gas, value, contractAddr, CREATE)
}

// Create2 creates a new contract using code as deployment code.
//
// The different between Create2 with Create is Create2 uses keccak256(0xff ++ msg.sender ++ salt ++ keccak256(init_code))[12:]
// instead of the usual sender-and-nonce-hash as the address where the contract is initialized at.
func (evm *EVM) Create2(caller ContractRef, code []byte, gas uint64, endowment *uint256.Int, salt *uint256.Int) (ret []byte, contractAddr common.Address, leftOverGas uint64, err error) {
	codeAndHash := &codeAndHash{code: code}
	contractAddr = crypto.CreateAddress2(caller.Address(), salt.Bytes32(), codeAndHash.Hash().Bytes())
	return evm.create(caller, codeAndHash, gas, endowment, contractAddr, CREATE2)
}
```

