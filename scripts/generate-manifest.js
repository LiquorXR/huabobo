const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, '../public/models');
const manifestPath = path.join(modelsDir, 'manifest.json');

console.log('正在扫描模型文件夹...');

let files = [];
try {
  files = fs.readdirSync(modelsDir);
} catch (e) {
  console.error('无法读取 models 文件夹:', e);
  process.exit(1);
}

// 支持的模型格式
const supportedExtensions = ['.obj', '.glb', '.gltf', '.stl'];
const modelFiles = files.filter(file => supportedExtensions.includes(path.extname(file).toLowerCase()));

// 默认必定带有的基础面团
const manifest = {
  models: [
    {
      name: "基础面团",
      id: "default",
      path: "sphere",
      type: "primitive"
    }
  ]
};

// 遍历添加外部模型
modelFiles.forEach((file, index) => {
  const ext = path.extname(file);
  const rawName = path.basename(file, ext);
  
  // 美化名称（如果有 `-` 或 `_` 转换为中文字体显示更友好的格式或空格，也可以保持原样）
  const displayName = rawName.replace(/[-_]/g, ' ');

  manifest.models.push({
    name: displayName,
    id: `model_${index + 1}`,
    path: file,
    type: "external"
  });
});

try {
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`✅ 成功生成 manifest.json！共找到 ${manifest.models.length} 个模型（含基础面团）。`);
} catch (e) {
  console.error('写入 manifest.json 失败:', e);
  process.exit(1);
}
