# Agent-Forge 项目审查重点

## 技术栈概览

- Electron + Vue 3 + TypeScript
- 主进程：`src/main/**`
- 预加载层：`src/preload/**`
- 渲染层：`src/renderer/**`

## 高风险区域

1. IPC 与文件系统边界
   - 是否限制路径范围，避免任意读写。
   - 是否对输入参数做白名单校验。

2. Preload 暴露面
   - 是否仅暴露最小业务 API。
   - 是否泄露高权限原语（通用 ipcRenderer/process env）。

3. Electron 安全配置
   - `sandbox` / `contextIsolation` / `nodeIntegration` 是否合理。
   - 外链打开是否有协议白名单。

4. CSP 与回归
   - CSP 调整后 Monaco 编辑器是否正常。
   - 是否引入过宽的远程脚本来源。

5. 状态一致性与竞态
   - 异步返回后是否写入错误对象。
   - 保存与刷新后 UI 状态是否一致。

6. 稳定性与性能
   - 主进程同步 I/O 是否造成阻塞。
   - 递归扫描是否有深度限制和异常兜底。

## 建议命令

- `npm run typecheck`
- `npm run lint`
- `rg -n "ipcMain\\.handle|writeFileSync|readFileSync|openExternal|v-html|DOMPurify" src`
