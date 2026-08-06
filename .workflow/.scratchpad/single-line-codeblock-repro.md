进步了！clang 找到了，但缺少共享库 `libtinfo.so.5`。装一下：

```bash
sudo apt-get install -y libncurses5
```

如果提示找不到这个包（较新的 Ubuntu 版本），试：

```bash
sudo apt-get install -y libtinfo5
```

对比：下面是多行代码块（应有复制按钮）：

```bash
echo "line 1"
echo "line 2"
```
