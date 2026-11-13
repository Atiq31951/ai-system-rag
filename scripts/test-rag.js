import { searchPolicies, MIN_SCORE } from '../src/modules/rag/rag.service.js';

const query = process.argv.slice(2).join(' ') || 'What is your refund policy?';

console.log(`\n🔍 Searching policies for: "${query}"`);
console.log('='.repeat(60));

const results = await searchPolicies(query);

if (results.length === 0) {
  console.log(`❌ No matching policy found above MIN_SCORE (${MIN_SCORE}).`);
} else {
  console.log(`✅ Found ${results.length} relevant policy chunk(s):\n`);

  results.forEach((r, idx) => {
    console.log(`[Result #${idx + 1}]`);
    console.log(`  ⭐ Similarity Score: ${(r.score * 100).toFixed(2)}% (${r.score})`);
    console.log(`  📁 Source File:      data/policies/${r.source}`);
    console.log(`  📌 Section Heading:  ## ${r.heading}`);
    console.log(`  📝 Policy Text:`);
    console.log(`     ${r.text.split('\n').join('\n     ')}`);
    console.log('-'.repeat(60));
  });
}

