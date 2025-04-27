/**
 * OpenAI API Router Worker
 * 
 * 路由规则配置通过环境变量实现：
 * MODEL_MAPPINGS: 包含JSON格式的模型关键词到API端点的映射
 * API_KEYS: 包含JSON格式的API端点到API密钥的映射
 * AUTH_KEYS: 包含允许访问的自定义API密钥列表的JSON数组
 *
 */

// 处理fetch请求事件
export default {
  async fetch(request, env, ctx) {
    // 处理CORS预检请求
    if (request.method === 'OPTIONS') {
      return handleCors(request);
    }

    // 处理GET请求，返回简单的状态信息
    if (request.method === 'GET') {
      return new Response(JSON.stringify({
        status: 'ok',
        message: 'OpenAI API Router is running'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 只处理POST请求
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      // 获取认证头
      const authHeader = request.headers.get('Authorization') || '';
      const apiKey = authHeader.replace('Bearer ', '').trim();
      
      // 验证API密钥
      if (!isValidApiKey(apiKey, env)) {
        return new Response(JSON.stringify({
          error: {
            message: '请输入WorkersRouting中自定义apikey',
            type: 'invalid_request_error',
            code: 'invalid_api_key'
          }
        }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
      
      // 克隆请求以便多次读取
      const clonedRequest = request.clone();
      const requestBody = await clonedRequest.json();
      
      // 确定应该使用哪个API端点
      const { targetEndpoint, targetApiKey } = determineTargetApi(requestBody, env);
      
      // 创建新的请求头，保留原始请求的某些头部
      const headers = new Headers();
      headers.set('Content-Type', 'application/json');
      headers.set('Authorization', `Bearer ${targetApiKey}`);
      
      // 原始请求中可能有的其他头部
      for (const [key, value] of request.headers.entries()) {
        if (!['host', 'content-length', 'authorization'].includes(key.toLowerCase())) {
          headers.set(key, value);
        }
      }

      // 获取请求的路径部分
      const url = new URL(request.url);
      let apiPath = url.pathname;
      
      // 如果是Cloudflare API，它的URL结构与其他不同，需要特殊处理
      if (targetEndpoint.includes('cloudflare.com')) {
        // Cloudflare AI API 不需要v1前缀，直接使用完整URL
        const targetUrl = `${targetEndpoint}${apiPath.replace(/^\/v1/, '')}`;
        
        console.log(`Forwarding to Cloudflare API: ${targetUrl}`);
        
        // 创建新的请求对象
        const newRequest = new Request(targetUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
        });

        // 执行请求并返回响应
        const response = await fetch(newRequest);
        return createCorsResponse(response);
      }
      
      // 处理其他API的情况
      // 移除前导和尾随斜杠以确保干净的URL
      const cleanEndpoint = targetEndpoint.replace(/\/$/, "");
      const cleanPath = apiPath.replace(/^\//, "");
      
      // 构建新的请求URL
      const targetUrl = `${cleanEndpoint}/${cleanPath}`;
      
      console.log(`Forwarding to: ${targetUrl}`);
      
      // 创建新的请求对象
      const newRequest = new Request(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      // 执行请求并返回响应
      const response = await fetch(newRequest);
      return createCorsResponse(response);
    } catch (error) {
      console.error('Error processing request:', error);
      return new Response(JSON.stringify({ 
        error: {
          message: error.message,
          stack: error.stack,
          type: 'server_error'
        }
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};

/**
 * 验证API密钥是否有效
 */
function isValidApiKey(apiKey, env) {
  if (!apiKey) {
    return false;
  }
  
  try {
    // 从环境变量解析允许的API密钥列表
    let authKeys = [];
    
    if (env.AUTH_KEYS) {
      authKeys = JSON.parse(env.AUTH_KEYS);
    } else {
      // 如果AUTH_KEYS环境变量未定义，返回错误
      console.error("AUTH_KEYS环境变量未定义");
      return false;
    }
    
    // 检查提供的API密钥是否在允许的列表中
    return authKeys.includes(apiKey);
  } catch (error) {
    console.error("Error parsing AUTH_KEYS:", error);
    return false;
  }
}

/**
 * 处理CORS预检请求
 */
function handleCors(request) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/**
 * 创建带有CORS头的响应
 */
function createCorsResponse(response) {
  // 创建新的响应对象以添加CORS头部
  const newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
  
  // 添加CORS头部
  newResponse.headers.set('Access-Control-Allow-Origin', '*');
  newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  newResponse.headers.set('Access-Control-Allow-Headers', '*');
  
  return newResponse;
}

/**
 * 根据模型名称决定使用哪个API端点
 */
function determineTargetApi(requestBody, env) {
  // 保留原始大小写，不转换为小写
  const modelName = requestBody.model || '';
  
  console.log(`Processing request for model: ${modelName}`);
  
  // 从环境变量解析模型映射配置
  let modelMappings = {};
  let apiKeys = {};
  
  try {
    // 从环境变量中解析模型映射
    if (env.MODEL_MAPPINGS) {
      modelMappings = JSON.parse(env.MODEL_MAPPINGS);
    } else {
      // 如果MODEL_MAPPINGS未定义，返回错误
      throw new Error("MODEL_MAPPINGS环境变量未定义");
    }
    
    // 从环境变量中解析API密钥映射
    if (env.API_KEYS) {
      apiKeys = JSON.parse(env.API_KEYS);
    } else {
      // 如果API_KEYS未定义，返回错误
      throw new Error("API_KEYS环境变量未定义");
    }
  } catch (error) {
    console.error("Error parsing environment variables:", error);
    throw new Error(`配置错误: ${error.message}`);
  }
  
  console.log("Available model mappings:", Object.keys(modelMappings).join(", "));
  
  // 根据模型名称匹配关键词
  let targetEndpoint = null;
  
  // 查找包含关键词的第一个匹配项（大小写敏感）
  for (const [keyword, endpoint] of Object.entries(modelMappings)) {
    if (modelName.includes(keyword)) {
      targetEndpoint = endpoint;
      console.log(`Matched keyword "${keyword}" for model "${modelName}"`);
      break;
    }
  }
  
  // 如果没有匹配，使用默认API（第一个映射）
  if (!targetEndpoint) {
    const defaultEndpoint = Object.values(modelMappings)[0];
    console.log(`No match found for model "${modelName}", using default endpoint: ${defaultEndpoint}`);
    targetEndpoint = defaultEndpoint;
  }
  
  // 获取API密钥
  let targetApiKey = apiKeys[targetEndpoint];
  
  // 如果没有找到密钥，尝试使用默认密钥
  if (!targetApiKey) {
    console.log(`No API key found for endpoint ${targetEndpoint}, using first available key`);
    targetApiKey = Object.values(apiKeys)[0];
  }
  
  console.log(`Selected API endpoint: ${targetEndpoint}`);
  
  return {
    targetEndpoint,
    targetApiKey
  };
} 
