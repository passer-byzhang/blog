---
title: Node.js连接Redis遇到的一个问题
date: 2022-11-09 11:09:30
tags:
- Node.js
- Redis
categories: 
- Node.js
description: redis配置失效导致 Error:connect ECONNREFUSED 127.0.0.1:6379
---
最近在折腾node后端，遇到了一个redis连接失败的问题，记录一下：

场景复现：
本地连接redis代码：

```javascript
const client = redis.createClient("6379", "127.0.0.1");

client.on("connect", function () {
  console.log("Redis Connected!");
});

client.connect();
```

服务器连接redis代码：
```javascript
const client = redis.createClient("6379", "172.17.0.1");//redis docker 的 host 和 port

client.on("connect", function () {
  console.log("Redis Connected!");
});

client.connect();
```

本地连接成功，服务器连接redis docker失败，
报错：

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

之后无论怎么修改配置端口号和host都会报错说连不上`127.0.0.1:6379`。
后排查原因发现`redis.createClient("6379", "172.17.0.1");`代码错误，导致redis绕过配置连接默认host和端口号，本地的redis恰好在默认`127.0.0.1:6379`下运行。
修改方法：
将 `redis.createClient("6379", "172.17.0.1");` 
修改为：

```javascript
const client = redis.createClient({
  url: "redis://172.17.0.1:60379",
});
```

即可。

