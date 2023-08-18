---
title: centos搭建rust环境的几个坑
date: 2022-08-25 11:55:52
tags: 
- Rust
- linux
categories: Rust
description: 记录几个centos玩rust的几个坑
---



这两天搭aptos测试网节点，本来以为像喝汤一样简单，对着手册突突突突弄下去就行了。没在新服务器上干过活，啥都要从头装，遇到了几个坑，记录一下

## 1.clang版本太低，centos是默认安装3.4版本，rust要求至少3.9

解决方法：

安装`llvm-toolset-7`

```bash
$ sudo yum install centos-release-scl
$ sudo yum install llvm-toolset-7
```

开启 `llvm-toolset-7`:

```bash
$ scl enable llvm-toolset-7 bash
```

检查一下

```bash
$ clang --version
```

## 2.gcc版本不匹配，有些程序需要C++17的特性，centos用yum默认下载的版本也不对

解决方法：

安装 `devtoolset-8`:

```bash
$ sudo yum install centos-release-scl
$ sudo yum install devtoolset-8
```

开启 `devtoolset-8`:

```bash
$ scl enable devtoolset-8 bash
```
