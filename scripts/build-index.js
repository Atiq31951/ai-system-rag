import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../src/config/index.js';
import { ollamaClient } from '../src/infrastructure/ollama.client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POLICIES_DIR = path.resolve(__dirname, '../data/policies');
const OUTPUT_FILE = path.resolve(__dirname, '../data/embeddings.json');

/**
 * Splits markdown content by "## " headings into chunks.
 *
 * @param {string} filename - e.g. "refund.md"
 * @param {string} content - raw markdown text
 * @returns {Array<{ id: string, source: string, heading: string, text: string }>}
 */
function chunkMarkdown(filename, content) {
  const sections = content.split('\n## ');
  const chunks = [];
  const baseName = filename.replace('.md', '');

  // sections[0] is typically the "# Title" header; chunks start from sections[1]
  for (let i = 1; i < sections.length; i++) {
    const section = sections[i].trim();
    if (!section) continue;

    const firstLineEnd = section.indexOf('\n');
    let heading = '';
    let text = '';

    if (firstLineEnd === -1) {
      heading = section.trim();
      text = '';
    } else {
      heading = section.slice(0, firstLineEnd).trim();
      text = section.slice(firstLineEnd + 1).trim();
    }

    chunks.push({
      id: `${baseName}-${i}`,
      source: filename,
      heading,
      text,
    });
  }

  return chunks;
}


async function buildIndex() {
  console.log(`Starting policy indexing using embedding model: ${config.embedModel}...`);

  const files = await fs.readdir(POLICIES_DIR);
  const mdFiles = files.filter((f) => f.endsWith('.md'));

  const allChunks = [];

  for (const file of mdFiles) {
    const filePath = path.join(POLICIES_DIR, file);
    const content = await fs.readFile(filePath, 'utf-8');
    const chunks = chunkMarkdown(file, content);
    allChunks.push(...chunks);
  }

  console.log(`Extracted ${allChunks.length} chunks from ${mdFiles.length} policy files.`);

  const indexData = [];

  for (let i = 0; i < allChunks.length; i++) {
    const chunk = allChunks[i];
    const textToEmbed = `${chunk.heading}\n${chunk.text}`;

    console.log(`[${i + 1}/${allChunks.length}] Embedding ${chunk.id}: "${chunk.heading}"...`);
    const embedRes = await ollamaClient.embed({
      input: textToEmbed,
      model: config.embedModel,
    });

    const embedding = embedRes.embeddings[0];

    indexData.push({
      id: chunk.id,
      source: chunk.source,
      heading: chunk.heading,
      text: chunk.text,
      embedding,
    });
  }

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(indexData, null, 2), 'utf-8');
  console.log(`\nSuccessfully indexed ${indexData.length} chunks to ${OUTPUT_FILE}`);
}

buildIndex().catch((err) => {
  console.error('Indexing failed:', err);
  process.exit(1);
});

