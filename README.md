# OpenAI API 路由转发 Worker / API Routing Worker

<div align="center">
  <a href="#openai-api-路由转发-worker">中文文档</a> | 
  <a href="#openai-api-routing-worker">English Document</a>
</div>

---

这是一个 Cloudflare Worker，用于将 OpenAI API 格式的请求根据模型名称路由到不同的 API 端点。
问：该项目可以做什么？
答：【实现统一api端点，统一apikey】，方便管理和应用。
问：该项目涉及收费吗？
答：完全免费！且无需部署任何docker或服务器。在 Free 计划中，您每天可发送的 Worker 请求总数达 100,000 个！

------------------------

## 配置映射规则

Worker 通过环境变量配置模型关键词与API端点的映射关系。

只需在项目根目录下配置文件wrangler.toml写好规则即可自定义路由：

1. **MODEL_MAPPINGS**: JSON 格式的模型关键词到 API 端点的映射
2. **API_KEYS**: JSON 格式的 API 端点到 API 密钥的映射
3. **AUTH_KEYS**: JSON 格式的允许访问的自定义API密钥列表

以下为个人习惯配置示例，可以根据你自己喜欢的大模型和厂商来修改，理论上支持所有openai通用请求：

```json
MODEL_MAPPINGS = {
  "gpt": "https://api.xi-ai.cn/v1",
  "deepseek": "https://api.ppinfra.com/v3/openai",
  "free": "https://openrouter.ai/api/v1",
  "@cf": "https://api.cloudflare.com/client/v4/accounts/xxxx/ai/v1"
}

API_KEYS = {
  "https://api.xi-ai.cn/v1": "sk-xxxx",
  "https://api.ppinfra.com/v3/openai": "sk-yyyy",
  "https://openrouter.ai/api/v1": "sk-zzzz",
  "https://api.cloudflare.com/client/v4/accounts/xxxx/ai/v1": "api-key-aaaa"
}

AUTH_KEYS = [
  "sk-my-secret-key-1", 
  "sk-my-secret-key-2"
]
```

当用户请求中【包含模型特定关键词】时，请求将被转发到对应的API端点：
- 包含 **"gpt"** 字样的模型ID请求 → 转发到 `https://api.xi-ai.cn/v1`
- 包含 **"deepseek"** 字样的模型ID请求 → 转发到 `https://api.ppinfra.com/v3/openai`
- 依此类推...
根据您的使用习惯和常用模型配置，可以添加更多映射。
您可以随时在 Cloudflare Dashboard 中修改这些环境变量，或者在 wrangler.toml 文件中更新它们，而无需修改代码。

## API自定义密钥验证

为了保护您的API不被未授权访问，该项目实现了自定义API密钥验证机制：

1. 只有在 `AUTH_KEYS` 环境变量中列出的API密钥才能访问您的Worker
2. 您可以设置多个有效的API密钥，便于在不同场景下使用
3. 当客户端发送请求时，它们需要在Authorization头中提供您的自定义API密钥
4. Worker会验证此密钥，然后在转发请求到实际API端点时替换为正确的提供商API密钥

这样，即使有人知道您的Worker URL，如果没有您设置的自定义API密钥，他们也无法使用您的服务。

## 部署说明

1. 确保已安装 [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/):

```
npm install -g wrangler
```

2. 登录到 Cloudflare 账户:

```
wrangler login
```

3. 部署 Worker:

```
npm run deploy
```

## 使用方式

部署后，您将获得一个唯一的 Cloudflare Worker URL。使用此 URL 作为 OpenAI API 的基础 URL，并在请求中提供您预先定义的自定义API密钥。

注意：国内用户由于无法直接访问cloudflare workers给的子域名，需要给cloudflare workers配置自定义子域名才可以使用（需要在cloudflare上已经配置了域名）
打开cloudflare - wokers - 找到你刚部署的wokers - setting -设置子域名

然后就可以愉快用你自己的子域名使用各种大模型服务啦！

例如，若需使用 Xi API:
```
curl https://your-worker.your-subdomain.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-my-secret-key-1" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

若需使用 PPInfra API:
```
curl https://your-worker.your-subdomain.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-my-secret-key-1" \
  -d '{
    "model": "deepseek-coder-33b-instruct",
    "messages": [{"role": "user", "content": "Write a function to calculate Fibonacci numbers"}]
  }'
```

您的客户端应用程序（如ChatBox或ChatNextWeb）只需要知道：
1. 您的Worker URL (例如：https://your-worker.your-subdomain.workers.dev)或者您给worker的自定义子域名
2. 您的自定义API密钥 (例如：sk-xxxxxx)
3. 您需要使用的模型ID

Worker会根据请求的模型名称自动路由到正确的API端点并使用相应的提供商API密钥。这样您就可以使用单一的API端点和密钥访问所有配置的模型。

---

# OpenAI API Routing Worker

This is a Cloudflare Worker designed to route OpenAI API format requests to different API endpoints based on the model name.

Q: What can this project do?
A: It implements a unified API endpoint with a unified API key, making management and application convenient.

Q: Does this project involve any fees?
A: Completely free! No need to deploy any docker or server. With the Free plan, you can send up to 100,000 Worker requests per day!

------------------------

## Configuration Mapping Rules

The Worker configures model keyword to API endpoint mappings through environment variables.

Just write the rules in the wrangler.toml configuration file in the project root directory to customize routing:

1. **MODEL_MAPPINGS**: JSON format mapping from model keywords to API endpoints
2. **API_KEYS**: JSON format mapping from API endpoints to API keys
3. **AUTH_KEYS**: JSON format list of custom API keys allowed for access

Below is a personal configuration example, which you can modify according to your preferred large models and providers. In theory, it supports all OpenAI universal requests:

```json
MODEL_MAPPINGS = {
  "gpt": "https://api.xi-ai.cn/v1",
  "deepseek": "https://api.ppinfra.com/v3/openai",
  "free": "https://openrouter.ai/api/v1",
  "@cf": "https://api.cloudflare.com/client/v4/accounts/xxxx/ai/v1"
}

API_KEYS = {
  "https://api.xi-ai.cn/v1": "sk-xxxx",
  "https://api.ppinfra.com/v3/openai": "sk-yyyy",
  "https://openrouter.ai/api/v1": "sk-zzzz",
  "https://api.cloudflare.com/client/v4/accounts/xxxx/ai/v1": "api-key-aaaa"
}

AUTH_KEYS = [
  "sk-my-secret-key-1", 
  "sk-my-secret-key-2"
]
```

When a user request contains a specific model keyword, the request will be forwarded to the corresponding API endpoint:
- Requests containing **"gpt"** in the model ID → forwarded to `https://api.xi-ai.cn/v1`
- Requests containing **"deepseek"** in the model ID → forwarded to `https://api.ppinfra.com/v3/openai`
- And so on...

Based on your usage habits and commonly used models, you can add more mappings.
You can modify these environment variables at any time in the Cloudflare Dashboard, or update them in the wrangler.toml file without modifying the code.

## Custom API Key Authentication

To protect your API from unauthorized access, this project implements a custom API key authentication mechanism:

1. Only API keys listed in the `AUTH_KEYS` environment variable can access your Worker
2. You can set multiple valid API keys for use in different scenarios
3. When clients send requests, they need to provide your custom API key in the Authorization header
4. The Worker will validate this key, then replace it with the correct provider API key when forwarding the request to the actual API endpoint

This way, even if someone knows your Worker URL, they cannot use your service without your custom API key.

## Deployment Instructions

1. Make sure you have installed [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/):

```
npm install -g wrangler
```

2. Log in to your Cloudflare account:

```
wrangler login
```

3. Deploy the Worker:

```
npm run deploy
```

## Usage

After deployment, you will get a unique Cloudflare Worker URL. Use this URL as the base URL for the OpenAI API and provide your predefined custom API key in the request.

Note: Users in China cannot directly access the subdomain provided by Cloudflare Workers, so you need to configure a custom subdomain for Cloudflare Workers (requires that you have already configured a domain on Cloudflare).
Open Cloudflare - Workers - Find the worker you just deployed - Settings - Set subdomain

Then you can happily use various large model services with your own subdomain!

For example, if you need to use Xi API:
```
curl https://your-worker.your-subdomain.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-my-secret-key-1" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

If you need to use PPInfra API:
```
curl https://your-worker.your-subdomain.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-my-secret-key-1" \
  -d '{
    "model": "deepseek-coder-33b-instruct",
    "messages": [{"role": "user", "content": "Write a function to calculate Fibonacci numbers"}]
  }'
```

Your client application (such as ChatBox or ChatNextWeb) only needs to know:
1. Your Worker URL (e.g., https://your-worker.your-subdomain.workers.dev) or your custom subdomain for the worker
2. Your custom API key (e.g., sk-xxxxxx)
3. The model ID you need to use

The Worker will automatically route to the correct API endpoint based on the model name in the request and use the corresponding provider API key. This way, you can access all configured models using a single API endpoint and key.