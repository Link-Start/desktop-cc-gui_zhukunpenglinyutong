/**
 * 文件图标映射工具
 * 极简单色 outline 图标（lucide 风格），返回内联 SVG 字符串，
 * 用于支持 vite-plugin-singlefile 打包。
 * 颜色跟随 currentColor，由使用处的 CSS 控制，自动适配明暗主题。
 */

const SVG_OPEN =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">';

function outlineIcon(paths: string): string {
  return `${SVG_OPEN}${paths}</svg>`;
}

const FILE_SHAPE =
  '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>';

const icon_folder = outlineIcon(
  '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
);

const icon_folder_open = outlineIcon(
  '<path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"/>',
);

const icon_file = outlineIcon(FILE_SHAPE);

const icon_file_text = outlineIcon(
  `${FILE_SHAPE}<path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>`,
);

const icon_file_code = outlineIcon(
  `${FILE_SHAPE}<path d="M10 12.5 8 15l2 2.5"/><path d="m14 12.5 2 2.5-2 2.5"/>`,
);

const icon_file_image = outlineIcon(
  `${FILE_SHAPE}<circle cx="10" cy="12" r="2"/><path d="m20 17-1.296-1.296a2.41 2.41 0 0 0-3.408 0L9 22"/>`,
);

const icon_git = outlineIcon(
  '<line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
);

/** 源码 / 样式 / 配置等代码类扩展名 */
const CODE_EXTENSIONS = new Set([
  // 编程语言
  'ts', 'tsx', 'cts', 'mts', 'js', 'jsx', 'cjs', 'mjs',
  'py', 'java', 'go', 'rs', 'php', 'c', 'cpp', 'cc', 'cxx', 'c++',
  'kt', 'kts', 'swift', 'rb', 'cs', 'csproj', 'sln', 'scala', 'sc',
  'pl', 'pm', 'lua', 'r', 'rmd', 'dart', 'ex', 'exs', 'erl', 'hrl',
  'hs', 'lhs', 'clj', 'cljs', 'cljc', 'fs', 'fsi', 'fsx', 'groovy',
  'gvy', 'jl', 'ml', 'mli', 'pas', 'pp', 'rkt', 'scm', 'lisp', 'lsp',
  'f', 'f90', 'f95', 'cob', 'cbl', 'asm', 's', 'd', 'nim', 'zig',
  'cr', 'purs', 'elm', 're', 'rei', 'odin', 'mojo', 'gleam', 'res',
  'resi', 'bal', 'h', 'hpp', 'hxx', 'm', 'mm', 'v', 'vh', 'vhd',
  'vhdl', 'sol', 'cairo', 'nix', 'raku', 'tcl', 'vim', 'ahk', 'coffee',
  // 标记 / 样式
  'html', 'htm', 'xml', 'css', 'scss', 'sass', 'less', 'styl',
  'stylus', 'pcss', 'postcss', 'vue', 'svelte', 'astro',
  // 模板
  'haml', 'pug', 'jade', 'ejs', 'hbs', 'handlebars', 'liquid',
  'njk', 'nunjucks', 'jinja', 'jinja2', 'j2', 'twig',
  // 配置 / 数据
  'json', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'properties',
  'hjson', 'env', 'editorconfig', 'dockerignore', 'gitignore',
  'gitattributes', 'npmrc', 'nvmrc', 'prettierrc', 'prettierignore',
  'eslintrc', 'eslintignore', 'babelrc', 'browserslistrc',
  'bashrc', 'zshrc',
  // 脚本 / 构建
  'sh', 'bash', 'zsh', 'fish', 'bat', 'cmd', 'ps1', 'psm1', 'psd1',
  'cmake', 'gradle', 'makefile', 'dockerfile', 'bazelrc',
  // 其他代码类
  'graphql', 'gql', 'prisma', 'proto', 'sql', 'sqlite', 'db',
  'tf', 'tfvars', 'hcl', 'k8s', 'http', 'rest', 'ipynb',
]);

/** 文档类扩展名 */
const TEXT_EXTENSIONS = new Set([
  'md', 'markdown', 'mdx', 'tex', 'adoc', 'asciidoc', 'rst', 'org',
  'txt', 'rtf', 'log', 'csv', 'tsv', 'pdf', 'doc', 'docx', 'epub',
]);

/** 图片 / 视觉媒体扩展名 */
const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'svg',
  'mp4', 'webm', 'mov', 'avi', 'mkv',
]);

/** 无扩展名但可归为代码类的文件名 */
const CODE_FILE_NAMES = new Set([
  'makefile', 'dockerfile', 'jenkinsfile', 'gemfile', 'rakefile',
  'procfile', 'pipfile', 'gradlew',
]);

/** 无扩展名但可归为文档类的文件名 */
const TEXT_FILE_NAMES = new Set(['readme', 'license', 'licence', 'changelog']);

/**
 * 根据文件扩展名 / 文件名获取图标 SVG
 */
export function getFileIcon(extension?: string, fileName?: string): string {
  const name = fileName?.toLowerCase() ?? '';
  if (name.startsWith('.git')) {
    return icon_git;
  }
  if (CODE_FILE_NAMES.has(name)) {
    return icon_file_code;
  }
  if (TEXT_FILE_NAMES.has(name)) {
    return icon_file_text;
  }

  const ext = extension?.toLowerCase() ?? '';
  if (!ext) {
    return icon_file;
  }
  if (ext === 'gitignore' || ext === 'gitattributes' || ext === 'gitmodules' || ext === 'gitkeep') {
    return icon_git;
  }
  if (CODE_EXTENSIONS.has(ext)) {
    return icon_file_code;
  }
  if (TEXT_EXTENSIONS.has(ext)) {
    return icon_file_text;
  }
  if (IMAGE_EXTENSIONS.has(ext)) {
    return icon_file_image;
  }
  return icon_file;
}

/**
 * 根据文件夹展开状态获取图标 SVG（极简风格下所有文件夹使用同一图标）
 */
export function getFolderIcon(_folderName: string, isOpen: boolean = false): string {
  return isOpen ? icon_folder_open : icon_folder;
}
