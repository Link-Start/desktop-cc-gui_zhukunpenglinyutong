/**
 * 批量读取文件分组组件
 * Groups multiple consecutive Read tool calls into a collapsible file list
 * 复用 Explored（explore-inline）样式：图标+标题头部、左侧 rail 缩进的 kind/label/detail 文本行
 */
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import type { ConversationItem } from '../../../../types';
import { parseToolArgs, getFirstStringField, getFileName } from './toolConstants';

type ToolItem = Extract<ConversationItem, { kind: 'tool' }>;

interface ReadToolGroupBlockProps {
  items: ToolItem[];
}

interface ParsedReadItem {
  id: string;
  fileName: string;
  filePath: string;
  isDirectory: boolean;
  lineInfo: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function getFirstStringInArray(source: Record<string, unknown> | null, keys: string[]): string {
  if (!source) return '';
  for (const key of keys) {
    const value = source[key];
    if (!Array.isArray(value)) continue;
    for (const entry of value) {
      if (typeof entry === 'string' && entry.trim()) {
        return entry.trim();
      }
    }
  }
  return '';
}

function parseReadItem(item: ToolItem): ParsedReadItem {
  const args = parseToolArgs(item.detail);
  const nestedInput = asRecord(args?.input);
  const nestedArgs = asRecord(args?.arguments);
  const pathKeys = [
    'file_path',
    'filePath',
    'filepath',
    'path',
    'target_file',
    'targetFile',
    'filename',
    'file',
  ];
  const listKeys = ['files', 'file_paths', 'filePaths', 'paths'];
  const filePath =
    getFirstStringField(args, pathKeys) ||
    getFirstStringField(nestedInput, pathKeys) ||
    getFirstStringField(nestedArgs, pathKeys) ||
    getFirstStringInArray(args, listKeys) ||
    getFirstStringInArray(nestedInput, listKeys) ||
    getFirstStringInArray(nestedArgs, listKeys);
  const fileName = getFileName(filePath);
  const isDirectory = filePath === '.' || filePath === '..' || (filePath?.endsWith('/') ?? false);

  const offset = args?.offset as number | undefined;
  const limit = args?.limit as number | undefined;
  let lineInfo = '';
  if (typeof offset === 'number' && typeof limit === 'number') {
    lineInfo = `L${offset + 1}-${offset + limit}`;
  }

  return { id: item.id, fileName, filePath, isDirectory, lineInfo };
}

export const ReadToolGroupBlock = memo(function ReadToolGroupBlock({
  items,
}: ReadToolGroupBlockProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);

  const parsed = useMemo(() => items.map(parseReadItem), [items]);

  if (parsed.length === 0) return null;

  const title = `${t('tools.batchReadFile')} (${parsed.length})`;

  return (
    <div className={`tool-inline explore-inline is-collapsible${isExpanded ? '' : ' is-collapsed'}`}>
      <div className="tool-inline-content">
        <div className="explore-inline-header">
          <button
            type="button"
            className="explore-inline-header-toggle"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
            aria-label={`${title} · ${t('messages.toggleDetails')}`}
          >
            <FileText className="explore-inline-icon" size={14} aria-hidden />
            <span className="explore-inline-title" title={title}>
              {title}
            </span>
          </button>
        </div>
        <div className={`explore-inline-list${isExpanded ? '' : ' is-collapsed'}`}>
          {parsed.map((entry) => (
            <div key={entry.id} className="explore-inline-item" title={entry.filePath}>
              <span className="explore-inline-kind">{entry.isDirectory ? 'List' : 'Read'}</span>
              <span className="explore-inline-label">
                {entry.fileName || entry.filePath || '...'}
              </span>
              {entry.lineInfo && <span className="explore-inline-detail">{entry.lineInfo}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

export default ReadToolGroupBlock;
