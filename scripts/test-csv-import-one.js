import fs from 'fs';
import path from 'path';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Load environment variables from .env.local
const envPath = join(projectRoot, '.env.local');
try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = envContent.split('\n').filter(line => line.includes('='));
  envVars.forEach(line => {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').trim();
    if (key && value) {
      process.env[key.trim()] = value;
    }
  });
} catch (error) {
  console.error('Could not load .env.local file:', error.message);
}

const csvPath = join(projectRoot, 'scripts', 'test-data', 'allrecipes-com-2026-06-21-2.csv');

function parseCSV(content) {
  const lines = [];
  let currentField = '';
  let inQuotes = false;
  let currentRow = [];

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField);
      lines.push(currentRow);
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    lines.push(currentRow);
  }
  return lines;
}

function extractImageUrl(row, headers) {
  const candidates = ['image_3', 'image_1', 'item_page_title', 'image'];
  for (const col of candidates) {
    const idx = headers.indexOf(col);
    if (idx !== -1 && row[idx]) {
      const val = row[idx].trim();
      if (val.startsWith('http')) {
        return val;
      }
      // Check if it is an img tag
      const imgMatch = val.match(/src="([^"]+)"/);
      if (imgMatch) {
        return imgMatch[1];
      }
    }
  }
  return null;
}

async function test() {
  const apiKey = process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ VITE_GEMINI_API_KEY is not defined in env.');
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCSV(content);
  const headers = rows[0];
  
  // Let's grab the first data row (index 1)
  const row = rows[1];
  const title = row[headers.indexOf('title')];
  const description = row[headers.indexOf('description')];
  const directionsRaw = row[headers.indexOf('Directions')];
  
  const instructions = directionsRaw
    .split(/\n\n+/)
    .map(s => s.trim())
    .filter(s => s);

  const imageUrl = extractImageUrl(row, headers);
  const sourceUrl = row[headers.indexOf('item_page_link')] || row[headers.indexOf('web_scraper_start_url')];

  console.log('--- Extracted from CSV ---');
  console.log('Title:', title);
  console.log('Description:', description);
  console.log('Instructions Count:', instructions.length);
  console.log('Image URL:', imageUrl);
  console.log('Source URL:', sourceUrl);

  console.log('\n--- Calling Gemini to infer ingredients ---');
  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `You are a professional chef. Given the following recipe, extract the list of ingredients with their quantities and units. If the quantities/units are mentioned in the directions but not explicitly listed, reconstruct them.
Return a JSON object matching this schema:
{
  "ingredients": ["string"],
  "prepTime": "string (e.g. '15 mins')",
  "cookTime": "string (e.g. '30 mins')",
  "servings": number (integer)
}

Recipe Details:
Title: ${title}
Description: ${description}
Directions:
${instructions.map((step, idx) => `${idx + 1}. ${step}`).join('\n')}
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    console.log('\nGemini Response:');
    console.log(response.text);
    const parsed = JSON.parse(response.text);
    console.log('\nParsed Object:', parsed);
  } catch (e) {
    console.error('Error calling Gemini:', e);
  }
}

test();
