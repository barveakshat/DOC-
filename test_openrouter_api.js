/**
 * OpenRouter API Connection Test
 * Tests if the OpenRouter API key is valid and working
 */

const API_KEY = "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";
const BASE_URL = "https://openrouter.ai/api/v1";
const MODEL = "openai/gpt-3.5-turbo";

async function testOpenRouterAPI() {
  console.log("🔍 Testing OpenRouter API Connection...\n");
  console.log("━".repeat(60));
  
  // Test 1: Check API Key Format
  console.log("\n1️⃣ Checking API Key Format...");
  if (!API_KEY || !API_KEY.startsWith("sk-or-v1-")) {
    console.log("❌ Invalid API key format. Should start with 'sk-or-v1-'");
    return;
  }
  console.log("✅ API key format is valid");
  
  // Test 2: Test Models Endpoint
  console.log("\n2️⃣ Testing Models Endpoint...");
  try {
    const modelsResponse = await fetch(`${BASE_URL}/models`, {
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "HTTP-Referer": "http://localhost:8080",
        "X-Title": "DOC+ Medical Assistant"
      }
    });
    
    if (!modelsResponse.ok) {
      const error = await modelsResponse.text();
      console.log(`❌ Models endpoint failed: ${modelsResponse.status}`);
      console.log(`   Error: ${error}`);
      return;
    }
    
    const models = await modelsResponse.json();
    console.log(`✅ Models endpoint working! Found ${models.data?.length || 0} models`);
    
    // Check if our model exists
    if (models.data) {
      const modelExists = models.data.some(m => m.id === MODEL || m.id === "openai/gpt-oss-20b:free");
      if (modelExists) {
        console.log(`✅ Target model is available`);
      } else {
        console.log(`⚠️  Model '${MODEL}' not found in available models`);
      }
    }
    
  } catch (error) {
    console.log(`❌ Models endpoint error: ${error.message}`);
    return;
  }
  
  // Test 3: Test Chat Completion
  console.log("\n3️⃣ Testing Chat Completion...");
  try {
    const chatResponse = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
        "HTTP-Referer": "http://localhost:8080",
        "X-Title": "DOC+ Medical Assistant"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: "Say 'Hello' if you can hear me."
          }
        ],
        max_tokens: 50
      })
    });
    
    if (!chatResponse.ok) {
      const error = await chatResponse.text();
      console.log(`❌ Chat completion failed: ${chatResponse.status}`);
      console.log(`   Error: ${error}`);
      
      // Try with free model
      console.log("\n   Trying with free model: openai/gpt-3.5-turbo:free");
      const freeResponse = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`,
          "HTTP-Referer": "http://localhost:8080",
          "X-Title": "DOC+ Medical Assistant"
        },
        body: JSON.stringify({
          model: "openai/gpt-3.5-turbo:free",
          messages: [{ role: "user", content: "Say 'Hello' if you can hear me." }],
          max_tokens: 50
        })
      });
      
      if (!freeResponse.ok) {
        const freeError = await freeResponse.text();
        console.log(`   ❌ Free model also failed: ${freeResponse.status}`);
        console.log(`   Error: ${freeError}`);
        return;
      }
      
      const freeData = await freeResponse.json();
      console.log(`   ✅ Free model works!`);
      console.log(`   Response: "${freeData.choices[0].message.content}"`);
      console.log(`   💡 Update your .env to use: VITE_OPENROUTER_MODEL="openai/gpt-3.5-turbo:free"`);
      return;
    }
    
    const chatData = await chatResponse.json();
    console.log(`✅ Chat completion successful!`);
    console.log(`   Model: ${chatData.model}`);
    console.log(`   Response: "${chatData.choices[0].message.content}"`);
    console.log(`   Tokens used: ${chatData.usage?.total_tokens || 'N/A'}`);
    
  } catch (error) {
    console.log(`❌ Chat completion error: ${error.message}`);
    return;
  }
  
  // Test 4: Check Credits (if available)
  console.log("\n4️⃣ Checking Account Status...");
  try {
    const creditsResponse = await fetch(`${BASE_URL}/auth/key`, {
      headers: {
        "Authorization": `Bearer ${API_KEY}`
      }
    });
    
    if (creditsResponse.ok) {
      const creditsData = await creditsResponse.json();
      console.log(`✅ Account active`);
      if (creditsData.data) {
        console.log(`   Label: ${creditsData.data.label || 'N/A'}`);
        if (creditsData.data.limit !== undefined) {
          console.log(`   Usage: $${creditsData.data.usage || 0} / $${creditsData.data.limit || 'Unlimited'}`);
        }
      }
    } else {
      console.log(`⚠️  Could not fetch account details (${creditsResponse.status})`);
    }
  } catch (error) {
    console.log(`⚠️  Could not check account status: ${error.message}`);
  }
  
  console.log("\n" + "━".repeat(60));
  console.log("\n🎉 OpenRouter API Test Complete!");
  console.log("\n✅ Your API is configured and working properly!");
}

// Run the test
testOpenRouterAPI().catch(error => {
  console.error("\n❌ Fatal error:", error);
  process.exit(1);
});
