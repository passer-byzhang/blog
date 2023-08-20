---
title: aptos初体验
date: 2022-07-30 03:07:07
tags: 
- Rust
- Aptos
categories: Aptos
description: Aptos链入门，发交易和构造合约
---


Aptos作为有背景有技术的新公链最近可谓吸满了投资，赚足了眼球。其从Libra和Diem继承来的技术又支持其超高tps和高安全高稳定的合约机制，官网上明晃晃的"Building the safest and most scalable Layer 1 blockchain."彰显着这群前FB工程师的野心。我们今天便浅尝一下这个技术和资本共同的宠儿，Aptos和Move语言。

Aptos是一条不兼容evm的Layer1公链，其特点是高安全性，高稳定性，高扩展性以及高达100k+的恐怖tps。独特的存储模型使其可能在NFT和GameFi领域大展身手。合约语言为Move，是一个基于Rust的内存安全型合约语言，在Libra时期便已经成型，目前Sui和Aptos都在使用它构造"有史以来最高性能的公链"。据社交媒体透露，现在Move语言开发者的工资时薪已经高达$1200，这让我不禁留下了悔恨的口水，哦不是，泪水。

这篇文章将从头到尾体验一下在Aptos链上发起交易和编写合约，不需要编写代码。通过运行，测试aptos官方事例，阅读	move代码，感受这个号称最安全Layer1链的魅力。官方事例给出了TypeScript，Rust，和Python三种语言的代码，考虑到aptos-core本身是由Rust编写而且其合约语言Move又与Rust极度相似，本文使用Rust事例进行讲解。

## 0.准备工作

安装rust，不多做介绍

下载aptos-core代码库 `git clone https://github.com/aptos-labs/aptos-core.git`

进入代码库`cd aptos-core`

切换分支`git checkout --track origin/devnet`

运行启动脚本，构建开发环境`./scripts/dev_setup.sh`

下载Aptos Commandline tool命令行工具`cargo install --git https://github.com/aptos-labs/aptos-core.git aptos`

## 1.发起交易

这一部分代码在`aptos-core/developer-docs-site/static/examples/rust/first_transaction`里：

### 1.1 创建账户

关于aptos的账户系统详情可以看官方文档: https://aptos.dev/concepts/basics-accounts

```rust
pub struct Account {
    signing_key: SecretKey,
}

impl Account {
    /// Represents an account as well as the private, public key-pair for the Aptos blockchain.
    pub fn new(priv_key_bytes: Option<Vec<u8>>) -> Self {
        let signing_key = match priv_key_bytes {
            Some(key) => SecretKey::from_bytes(&key).unwrap(),
            None => {
                let mut rng = rand::rngs::StdRng::from_seed(OsRng.gen());
                let mut bytes = [0; 32];
                rng.fill_bytes(&mut bytes);
                SecretKey::from_bytes(&bytes).unwrap()
            }
        };

        Account { signing_key }
    }
    /// Returns the address associated with the given account
    pub fn address(&self) -> String {
        self.auth_key()
    }

    /// Returns the auth_key for the associated account
    pub fn auth_key(&self) -> String {
        let mut sha3 = Sha3::v256();
        sha3.update(PublicKey::from(&self.signing_key).as_bytes());
        sha3.update(&vec![0u8]);

        let mut output = [0u8; 32];
        sha3.finalize(&mut output);
        hex::encode(output)
    }

    /// Returns the public key for the associated account
    pub fn pub_key(&self) -> String {
        hex::encode(PublicKey::from(&self.signing_key).as_bytes())
    }
}
```

### 1.2 准备一个REST接口包装器

​		构造一个RestClient，并连接测试网  https://fullnode.devnet.aptoslabs.com

```rust
#[derive(Clone)]
pub struct RestClient {
    url: String,
}

///RestClient中的方法
impl RestClient {
  
    //从url初始化client
    pub fn new(url: String) -> Self {
        Self { url }
  	}
    
    ///Rest请求的具体实现,下边详细讲解
    .......
}
    
```

#### 1.2.1 读取账户信息

以下代码是通过账户地址读取账户信息的接口实现

值得注意的是account_resource接口，aptos的任何账户都有data存储，可以用来储存货币/NFT等等，这些信息被称为resource。

如果我们要查询某个账户的AptosCoin余额，就要定位到0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin，查询对应的resource数据，在1.2.3中account_balance就是复用了该接口。

这里的0x1实际上是一个account地址，因为AptosCoin是root账户0x1发行的，所以会出现0x1这种写法，类似写法在下文也会出现。而coin::CoinStore<>是aptos对代币的resource的一种特殊处理，以提供安全性。这样的话可以理解为查询该账户下，由0x1发行的AptosCoin的数目。

详情见aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/sources/coin.move

```rust
    /// 返回账户的私钥和序列码sequence_number，详情见https://aptos.dev/concepts/basics-accounts
    pub fn account(&self, account_address: &str) -> serde_json::Value {
        let res =
            reqwest::blocking::get(format!("{}/accounts/{}", self.url, account_address)).unwrap();

        if res.status() != 200 {
            assert_eq!(
                res.status(),
                200,
                "{} - {}",
                res.text().unwrap_or("".to_string()),
                account_address,
            );
        }

        res.json().unwrap()
    }

    /// 返回账户所有相关信息
    pub fn account_resource(
        &self,
        account_address: &str,
        resource_type: &str,
    ) -> Option<serde_json::Value> {
        let res = reqwest::blocking::get(format!(
            "{}/accounts/{}/resource/{}",
            self.url, account_address, resource_type,
        ))
        .unwrap();

        if res.status() == 404 {
            None
        } else if res.status() != 200 {
            assert_eq!(
                res.status(),
                200,
                "{} - {}",
                res.text().unwrap_or("".to_string()),
                account_address,
            );
            unreachable!()
        } else {
            Some(res.json().unwrap())
        }
    }
    
```

#### 1.2.2 交易相关操作(生成，签名，提交)

```rust
    /// Generates a transaction request that can be submitted to produce a raw transaction that can be signed, which upon being signed can be submitted to the blockchain.
    pub fn generate_transaction(
        &self,
        sender: &str,
        payload: serde_json::Value,
    ) -> serde_json::Value {
        let account_res = self.account(sender);

        let seq_num = account_res
            .get("sequence_number")
            .unwrap()
            .as_str()
            .unwrap()
            .parse::<u64>()
            .unwrap();

        // Unix timestamp, in seconds + 10 minutes
        let expiration_time_secs = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("Time went backwards")
            .as_secs()
            + 600;

        serde_json::json!({
            "sender": format!("0x{}", sender),
            "sequence_number": seq_num.to_string(),
            "max_gas_amount": "1000",
            "gas_unit_price": "1",
            "gas_currency_code": "XUS",
            "expiration_timestamp_secs": expiration_time_secs.to_string(),
            "payload": payload,
        })
    }

    /// Converts a transaction request produced by `generate_transaction` into a properly signed transaction, which can then be submitted to the blockchain.
    pub fn sign_transaction(
        &self,
        account_from: &mut Account,
        mut txn_request: serde_json::Value,
    ) -> serde_json::Value {
        let res = reqwest::blocking::Client::new()
            .post(format!("{}/transactions/signing_message", self.url))
            .body(txn_request.to_string())
            .send()
            .unwrap();

        if res.status() != 200 {
            assert_eq!(
                res.status(),
                200,
                "{} - {}",
                res.text().unwrap_or("".to_string()),
                txn_request.as_str().unwrap_or(""),
            );
        }
        let body: serde_json::Value = res.json().unwrap();
        let to_sign_hex = Box::new(body.get("message").unwrap().as_str()).unwrap();
        let to_sign = hex::decode(&to_sign_hex[2..]).unwrap();
        let signature: String = ExpandedSecretKey::from(&account_from.signing_key)
            .sign(&to_sign, &PublicKey::from(&account_from.signing_key))
            .encode_hex();

        let signature_payload = serde_json::json!({
            "type": "ed25519_signature",
            "public_key": format!("0x{}", account_from.pub_key()),
            "signature": format!("0x{}", signature),
        });
        txn_request
            .as_object_mut()
            .unwrap()
            .insert("signature".to_string(), signature_payload);
        txn_request
    }

    /// Submits a signed transaction to the blockchain.
    pub fn submit_transaction(&self, txn_request: &serde_json::Value) -> serde_json::Value {
        let res = reqwest::blocking::Client::new()
            .post(format!("{}/transactions", self.url))
            .body(txn_request.to_string())
            .header("Content-Type", "application/json")
            .send()
            .unwrap();

        if res.status() != 202 {
            assert_eq!(
                res.status(),
                202,
                "{} - {}",
                res.text().unwrap_or("".to_string()),
                txn_request.as_str().unwrap_or(""),
            );
        }
        res.json().unwrap()
    }

    /// Submits a signed transaction to the blockchain.
    pub fn execution_transaction_with_payload(
        &self,
        account_from: &mut Account,
        payload: serde_json::Value,
    ) -> String {
        let txn_request = self.generate_transaction(&account_from.address(), payload);
        let signed_txn = self.sign_transaction(account_from, txn_request);
        let res = self.submit_transaction(&signed_txn);
        res.get("hash").unwrap().as_str().unwrap().to_string()
    }

    pub fn transaction_pending(&self, transaction_hash: &str) -> bool {
        let res = reqwest::blocking::get(format!("{}/transactions/{}", self.url, transaction_hash))
            .unwrap();

        if res.status() == 404 {
            return true;
        }

        if res.status() != 200 {
            assert_eq!(
                res.status(),
                200,
                "{} - {}",
                res.text().unwrap_or("".to_string()),
                transaction_hash,
            );
        }

        res.json::<serde_json::Value>()
            .unwrap()
            .get("type")
            .unwrap()
            .as_str()
            .unwrap()
            == "pending_transaction"
    }

    /// Waits up to 10 seconds for a transaction to move past pending state.
    pub fn wait_for_transaction(&self, txn_hash: &str) {
        let mut count = 0;
        while self.transaction_pending(txn_hash) {
            assert!(count < 10, "transaction {} timed out", txn_hash);
            thread::sleep(Duration::from_secs(1));
            count += 1;
        }
    }
    
```

#### 1.2.3 构造交易逻辑

一个是account_balance，使用account_resource调用AptosCoin资源查询
另一个是transfer，使用的是0x1::coin::transfer也就是coin共有方法transfer

```rust
    /// Returns the test coin balance associated with the account
    pub fn account_balance(&self, account_address: &str) -> Option<u64> {
        self.account_resource(
            account_address,
            "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>",
        )
        .unwrap()["data"]["coin"]["value"]
            .as_str()
            .and_then(|s| s.parse::<u64>().ok())
    }

    /// Transfer a given coin amount from a given Account to the recipient's account address.
    /// Returns the sequence number of the transaction used to transfer
    pub fn transfer(&self, account_from: &mut Account, recipient: &str, amount: u64) -> String {
        let payload = serde_json::json!({
            "type": "script_function_payload",
            "function": "0x1::coin::transfer",
            "type_arguments": ["0x1::aptos_coin::AptosCoin"],
            "arguments": [format!("0x{}", recipient), amount.to_string()]
        });
        let txn_request = self.generate_transaction(&account_from.address(), payload);
        let signed_txn = self.sign_transaction(account_from, txn_request);
        let res = self.submit_transaction(&signed_txn);

        res.get("hash").unwrap().as_str().unwrap().to_string()
    }
}
```

### 1.3 准备一个水龙头接口包装器

```rust
pub struct FaucetClient {
    url: String,
    rest_client: RestClient,
}

impl FaucetClient {

  	/// 水龙头可以创建账户并给其分配资产，这是一个包装器
    pub fn new(url: String, rest_client: RestClient) -> Self {
        Self { url, rest_client }
    }

    /// 给传入用户铸币
    pub fn fund_account(&self, auth_key: &str, amount: u64) {
        let res = reqwest::blocking::Client::new()
            .post(format!(
                "{}/mint?amount={}&auth_key={}",
                self.url, amount, auth_key
            ))
            .send()
            .unwrap();

        if res.status() != 200 {
            assert_eq!(
                res.status(),
                200,
                "{}",
                res.text().unwrap_or("".to_string()),
            );
        }
        for txn_hash in res.json::<serde_json::Value>().unwrap().as_array().unwrap() {
            self.rest_client
                .wait_for_transaction(txn_hash.as_str().unwrap())
        }
    }
}
```

### 1.4 运行测试

```rust
fn main() -> () {
    let rest_client = RestClient::new(TESTNET_URL.to_string());
    let faucet_client = FaucetClient::new(FAUCET_URL.to_string(), rest_client.clone());

  	//创建两个账户Alice和Bob，并用水龙头给Alice赚一笔账
    let mut alice = Account::new(None);
    let bob = Account::new(None);

    println!("\n=== Addresses ===");
    println!("Alice: 0x{}", alice.address());
    println!("Bob: 0x{}", bob.address());

    faucet_client.fund_account(&alice.auth_key().as_str(), 1_000_000);
    faucet_client.fund_account(&bob.auth_key().as_str(), 0);
		
  	//调用account_balance查询账户余额
    println!("\n=== Initial Balances ===");
    println!("Alice: {:?}", rest_client.account_balance(&alice.address()));
    println!("Bob: {:?}", rest_client.account_balance(&bob.address()));

    // Alice构造一笔向bob转账1000的交易并提交等待完成
    let tx_hash = rest_client.transfer(&mut alice, &bob.address(), 1_000);
    rest_client.wait_for_transaction(&tx_hash);
	  
  	//调用account_balance查询账户余额
    println!("\n=== Final Balances ===");
    println!("Alice: {:?}", rest_client.account_balance(&alice.address()));
    println!("Bob: {:?}", rest_client.account_balance(&bob.address()));
}
```

运行`cargo run --bin first-transaction`(运行前确保您在`aptos-core/developer-docs-site/static/examples/rust`目录下)

### 1.5 输出

可以看到转账成功后Alice和Bob的余额(去掉gas费)

```rust
=== Addresses ===
Alice: e26d69b8d3ff12874358da6a4082a2ac
Bob: c8585f009c8a90f22c6b603f28b9ed8c

=== Initial Balances ===
Alice: 1000000000
Bob: 0

=== Final Balances ===
Alice: 999998957
Bob: 1000
```

## 2.玩转合约

aptos链使用Move语言编写合约，其特点是安全稳定，语法上与Rust很像。

我们现在构建一个新的合约，在aptos的世界里称为module。

需要完成以下几个步骤：

1.编写，编译，测试module
2.部署module
3.与module的资源(存储区)交互

### 2.1 阅读合约代码

我们先进到`aptos-move/move-examples/hello_blockchain`目录里，我们暂且称其为“Move目录”，方便之后切换目录指称。

在这个目录里我们可以看到这个`sources/HelloBlockchain.move`文件，这个module可以让账户可以创建并修改一个String类型的资源，每个用户都只能操作自己的资源。

```rust
module HelloBlockchain::Message {
    use std::string;
    use std::error;
    use std::signer;

    struct MessageHolder has key {
        message: string::String,
    }

    public entry fun set_message(account: signer, message_bytes: vector<u8>)
    acquires MessageHolder {
        let message = string::utf8(message_bytes);
        let account_addr = signer::address_of(&account);
        if (!exists<MessageHolder>(account_addr)) {
            move_to(&account, MessageHolder {
                message,
            })
        } else {
            let old_message_holder = borrow_global_mut<MessageHolder>(account_addr);
            old_message_holder.message = message;
        }
    }
}
```

在上述代码中有两个关键，一个是结构体`MessageHolder` 一个是函数 `set_message`。 `set_message` 是一个script函数，允许被交易直接调用，调用它之后函数会确认账户是否有`MessageHolder` 资源，没有的话就创建一个并把信息写入，有的话就覆盖掉。

### 2.2测试合约

Move测试可以直接写在合约里，我们加上了一个sender_can_set_message测试函数，用cargo test进行测试。

运行 `cargo test test_hello_blockchain -p move-examples -- --exact` 即可。

```rust

    #[test(account = @0x1)]
    public(script) fun sender_can_set_message(account: signer) acquires MessageHolder {
        let addr = Signer::address_of(&account);
        set_message(account,  b"Hello, Blockchain");

        assert!(
          get_message(addr) == string::utf8(b"Hello, Blockchain"),
          0
        );
    }
```

### 2.3部署合约

现在我们回到之前transaction样例的同级目录，找到`developer-docs-site/static/examples/rust/hello_blockchain`查看部署和交互module的代码。这会复用一些上一节的函数。这一节我们只讨论新功能，比如部署module，`set_message`交易，以及读取`MessageHolder::message`资源，部署module和提交交易的区别就只有payload，我们开始看吧：

#### 2.3.1 部署module

```rust
pub struct HelloBlockchainClient {
    pub rest_client: RestClient,
}

impl HelloBlockchainClient {
    /// Represents an account as well as the private, public key-pair for the Aptos blockchain.
    pub fn new(url: String) -> Self {
        Self {
            rest_client: RestClient::new(url),
        }
    }

    /// Publish a new module to the blockchain within the specified account
    pub fn publish_module(&self, account_from: &mut Account, module_hex: &str) -> String {
        let payload = serde_json::json!({
            "type": "module_bundle_payload",
            "modules": [{"bytecode": format!("0x{}", module_hex)}],
        });
        self.rest_client
            .execution_transaction_with_payload(account_from, payload)
    }
    
```

#### 2.3.2 读取资源

Module 发布在一个地址上，就是下边的 `contract_address`。上一节转移Coin时候的0x1也是发布地址。

```rust
    /// Retrieve the resource Message::MessageHolder::message
    pub fn get_message(&self, contract_address: &str, account_address: &str) -> Option<String> {
        let module_type = format!("0x{}::Message::MessageHolder", contract_address);
        self.rest_client
            .account_resource(account_address, &module_type)
            .map(|value| value["data"]["message"].as_str().unwrap().to_string())
}

```

#### 2.3.3 修改资源

Module必须暴露出script函数才能初始化和修改资源，script可以被交易调用。

```rust
    /// Potentially initialize and set the resource Message::MessageHolder::message
    pub fn set_message(
        &self,
        contract_address: &str,
        account_from: &mut Account,
        message: &str,
    ) -> String {
        let message_hex = hex::encode(message.as_bytes());
        let payload = serde_json::json!({
            "type": "script_function_payload",
            "function": format!("0x{}::Message::set_message", contract_address),
            "type_arguments": [],
            "arguments": [message_hex]
        });
        self.rest_client
            .execution_transaction_with_payload(account_from, payload)
    }
    
```

### 2.4 初始化并交互

进入 `developer-docs-site/static/examples/rust`，我们姑且称为"App 目录"

运行 `cargo run --bin hello-blockchain -- Message.mv`

过了一会，控制台会输出Alice与Bob的账户信息并显示`Update the module with Alice's address, build, copy to the provided path, and press enter. `，记录下Alice的地址，不要关闭

这时我们另起一个控制台，进入"Move目录"，将`hello_blockchain/move.toml`中的 `HelloBlockChain='_'`配置为Alice地址。

运行`aptos move compile --package-dir . --named-addresses HelloBlockchain=0x{Alice的地址}`

Module编译成功，将`build/Examples/bytecode_modules/Message.mv`复制一份到`developer-docs-site/static/examples/rust`

在"App 目录"的控制台输入回车让它继续运行

输出如果类似这样就是成功了：

```
=== Addresses ===
Alice: 11c32982d04fbcc79b694647edff88c5b5d5b1a99c9d2854039175facbeefb40
Bob: 7ec8f962139943bc41c17a72e782b7729b1625cf65ed7812152a5677364a4f88

=== Initial Balances ===
Alice: 10000000
Bob: 10000000

Update the module with Alice's address, build, copy to the provided path, and press enter.

=== Testing Alice ===
Publishing...
Initial value: None
Setting the message to "Hello, Blockchain"
New value: Hello, Blockchain

=== Testing Bob ===
Initial value: None
Setting the message to "Hello, Blockchain"
New value: Hello, Blockchain
```

证明了Alice和Bob都新创建了Message资源并置为"Hello, Blockchain"

## 3.相关资料

Aptos 官方文档：https://aptos.dev
Move手册：https://move-language.github.io/move/
区块链浏览器：https://explorer.devnet.aptos.dev
api文档：https://fullnode.devnet.aptoslabs.com/spec.html#/