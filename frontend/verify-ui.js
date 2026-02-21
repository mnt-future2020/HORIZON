// Quick verification script
const fs = require('fs');
const path = require('path');

console.log('\n🔍 Verifying Athletic UI Implementation...\n');

const checks = [
  {
    name: 'Tailwind Config',
    file: 'tailwind.config.js',
    contains: ['display-xl', 'athletic', 'glow-pulse', 'gradient-athletic']
  },
  {
    name: 'Athletic CSS',
    file: 'src/index.css',
    contains: ['--gradient-primary', '--glow-primary', 'athletic typography']
  },
  {
    name: 'Athletic Animations',
    file: 'src/App.css',
    contains: ['athleticSlideUp', 'glowPulse', 'athletic-lift']
  },
  {
    name: 'Motion Variants',
    file: 'src/lib/motion-variants.js',
    contains: ['fadeInUp', 'cardHover', 'staggerContainer']
  },
  {
    name: 'Athletic Card',
    file: 'src/components/ui/athletic-card.jsx',
    contains: ['AthleticCard', 'whileHover']
  },
  {
    name: 'Stat Card',
    file: 'src/components/ui/stat-card.jsx',
    contains: ['AthleticStatCard', 'font-black']
  },
  {
    name: 'VenueDiscovery Page',
    file: 'src/pages/VenueDiscovery.js',
    contains: ['h-14', 'bg-gradient-to-br', 'hover:scale-105', 'font-black tracking-athletic', 'h-52']
  }
];

let allPassed = true;

checks.forEach(check => {
  try {
    const content = fs.readFileSync(path.join(__dirname, check.file), 'utf8');
    const passed = check.contains.every(str => content.includes(str));
    
    if (passed) {
      console.log(`✅ ${check.name}`);
    } else {
      console.log(`❌ ${check.name} - Missing some athletic features`);
      allPassed = false;
    }
  } catch (err) {
    console.log(`❌ ${check.name} - File not found`);
    allPassed = false;
  }
});

console.log('\n' + '='.repeat(50));
if (allPassed) {
  console.log('🎉 All athletic UI components verified!');
  console.log('\n💡 If you still see old UI:');
  console.log('   1. Stop dev server (Ctrl+C)');
  console.log('   2. Run: npm start');
  console.log('   3. Hard refresh browser: Cmd+Shift+R');
} else {
  console.log('⚠️  Some files are missing or incomplete');
}
console.log('='.repeat(50) + '\n');
