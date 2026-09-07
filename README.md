# WeFans · 奇洛 · 第一章「风球之下」

在线试玩：https://wefans-qiluo-online.onrender.com/ （需邀请人提供的测试口令）

第一章已上线。陈挽、赵声阁双视角，从机场归来，到接风宴、甜点变数、引见，再到檐下散场。可以选择眼前的行动，也可以自由输入；NPC 依据在场见闻、收到的消息和实际行动作出回应。结尾回顾本局发生过的事。

角色语音已按用户最新要求恢复：复用已有两个 MiniMax 音色，自动顺序播放新增主角对白，支持关闭、停止和单句重听。只读对白，不读动作或 NPC。雨夜环境声手动开启，说话时减弱。没有再次付费复刻音色。

第一章与旧版自由体验保留独立入口和存档。旧版页面没有启用自动语音；语音体验请进入第一章。已保存的旧文字可以继续，语音针对更新后产生的对白生效。浏览器首次播放需要一次点击，读档不会重放全部历史。

## 运行与部署

Node.js 22 或 24。正常部署使用已构建产物，不需要安装运行时依赖。

```sh
npm run build
npm test
npm start
```

Render home 工作区的服务使用 `wefans-online` 分支，`npm run build` 构建、`npm start` 启动；健康检查 `/healthz`。这是通过公开 Git URL 创建的服务，更新代码后需在 Render 手动部署。原仓库 main 分支游戏保留，WeFans 读取 `public/index.html`。

| 服务器环境变量 | 用途 |
| --- | --- |
| QILUO_API_KEY | DeepSeek API Key |
| QILUO_STATE_SECRET | 至少 32 字符的状态加密密钥 |
| TEST_ACCESS_CODE | 至少 8 字符的试玩口令 |
| QILUO_MODEL | 默认 deepseek-v4-pro |
| MINIMAX_API_KEY | MiniMax API Key |
| CHEN_VOICE_ID / ZHAO_VOICE_ID | 已有角色音色 ID |
| MINIMAX_TTS_MODEL | 默认 speech-2.8-hd |
| VOICE_PAUSED | 设为 true 可暂停服务器语音；默认启用 |

API Key、口令、原始录音及复刻音频不随公开源码发布。Render 提供 RENDER_EXTERNAL_URL，其他运行环境需设置 PUBLIC_ORIGIN。

## 验证与限制

24 组本地回归检查通过。自动测试使用模拟模型响应；真实 HTTPS 检查已覆盖两个视角完整通关、恢复进度、自由移动、NPC 主动追问和两位主角的语音输出。完整路线与后续声音更新分别验收，具体运行提交、时间和结果见 [chapter-verification.json](chapter-verification.json) 与 [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md)。

自由文字仍可能补出未经确立的细节，不能视为原著事实。当前已对部分无依据近况、错误敬称、关系越界和知识泄露加入约束，但不能保证所有表达都完全准确。后续可据具体试玩台词继续校准。

每局最多 30 次自由推演、100 次普通操作；章节选项不调用语言模型，到额度后仍可沿章节继续到结尾。语音合成单独计费，与声音复刻不同；每个访问会话每小时最多 80 次语音请求，缓存相同音色和文本以减少重复合成。基础频率限制不代表账户消费硬上限。进度在浏览器保存，由服务器加密校验，有效期 7 天。

## 更新源码

范围和人物规则见 [CHAPTER_ONE.md](CHAPTER_ONE.md)。修改 `src/` 后执行 `npm install --include=dev`、`npm run rebuild` 和 `npm test`，同时提交源文件、`public/index.html` 和 `lib/story-api.mjs`。语音入口为 `lib/voice.mjs`，只接受加密进度中的有效角色对白。
