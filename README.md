# WeFans · 奇洛在线试玩

可扮演陈挽或赵声阁，与对方和 NPC 互动。DeepSeek 负责自然语言回应，后台记录事件、人物知情范围和关系变化。陈挽和赵声阁的对白使用各自的 MiniMax 复刻音色，开场、玩家输入的台词及新回复可依次自动播放。雨夜环境声可调节，人物说话时自动减弱。

## 运行

运行环境为 Node.js 22 或 24。发布文件已构建，运行不需要安装第三方依赖。

```sh
npm run build
npm test
npm start
```

使用 GitHub 分支 `wefans-online` 部署到 Render，`buildCommand` 为 `npm run build`，`startCommand` 为 `npm start`。原仓库的根目录 `index.html` 保留，WeFans 服务读取 `public/index.html`。健康检查为 `/healthz`。

服务器环境变量：

| 变量 | 用途 |
| --- | --- |
| QILUO_API_KEY | DeepSeek API Key |
| QILUO_STATE_SECRET | 至少32字符的随机状态加密密钥 |
| TEST_ACCESS_CODE | 至少8字符的试玩口令 |
| QILUO_MODEL | 默认 deepseek-v4-pro |
| MINIMAX_API_KEY | MiniMax API Key |
| CHEN_VOICE_ID | 陈挽的复刻音色 ID |
| ZHAO_VOICE_ID | 赵声阁的复刻音色 ID |
| MINIMAX_TTS_MODEL | 默认 speech-2.8-hd |

所有 API Key 仅配置于服务器，不能写入 GitHub、网页或浏览器。Render 自动提供 RENDER_EXTERNAL_URL；在其他环境运行需设置 PUBLIC_ORIGIN。

## 语音与叙事

两个音色已实际完成复刻，并分别用新台词生成 MP3。选择页的音色试听由带试玩口令的服务器按需合成。原始参考录音和复刻音频文件都不上传到公开 GitHub 仓库。用户听感与相似度仍需真人确认。

语音接口只接收服务器签名进度与消息 ID，音色由真实说话人决定。旁白、NPC 和括号中的动作不朗读。输入台词时可用中文引号明确对白。自动播放可关闭，每条对白可单独重播，声音属于 AI 合成。

叙事提示使用原创、细腻、克制的表达，用动作、停顿和雨夜细节承接玩家选择。人物不会凭空得知异地私聊或未经核实的事情；转述与核实造成不同关系结果。人物设定与规则约束用于降低 OOC，仍需持续体验校准。

## 验证和试玩范围

`npm test` 验证邀请口令、跨站请求拒绝、Cookie、源文件隔离、签名状态、双主角、NPC 转述与核实的因果关系、开场和玩家对白的音色绑定、仅朗读对白、缓存以及未配置音色的提示。测试中的供应商响应为模拟数据；真实 MiniMax 复刻已完成，两种玩家身份的 DeepSeek 新回复及四条对应音色语音也已实际通过联调。

每段支持30次模型互动。进度保存在玩家浏览器，服务器加密校验，7天有效。基础频率限制用于小范围试玩，并非整个账户的钱包消费硬上限。语音与文字 API 单独计费。Render 免费服务闲置后会休眠，首次打开可能需要等待启动。

界面交互与线上服务可用性以实际部署验收结果为准，参见 verification.json。

## 更新代码

可编辑源码位于 `src/`，后端入口为 `server.mjs`，语音鉴权与分流为 `lib/voice.mjs`。需要修改前端或角色逻辑时，执行 `npm install --include=dev`、`npm run rebuild` 和 `npm test`，再提交源文件及更新的构建文件。正常部署直接使用已构建的产物。
