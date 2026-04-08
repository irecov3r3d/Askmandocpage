/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, X } from 'lucide-react';
import { URLGroup, Document } from '../types';

interface KnowledgeBaseManagerProps {
  urls: string[];
  documents: Document[];
  onAddUrl: (url: string) => void;
  onRemoveUrl: (url: string) => void;
  onAddDocument: (doc: Document) => void;
  onRemoveDocument: (id: string) => void;
  maxUrls?: number;
  urlGroups: URLGroup[];
  activeUrlGroupId: string;
  onSetGroupId: (id: string) => void;
  onCloseSidebar?: () => void;
}

const KnowledgeBaseManager: React.FC<KnowledgeBaseManagerProps> = ({ 
  urls, 
  documents,
  onAddUrl, 
  onRemoveUrl, 
  onAddDocument,
  onRemoveDocument,
  maxUrls = 20,
  urlGroups,
  activeUrlGroupId,
  onSetGroupId,
  onCloseSidebar,
}) => {
  const [currentUrlInput, setCurrentUrlInput] = useState('');
  const [currentNoteInput, setCurrentNoteInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isValidUrl = (urlString: string): boolean => {
    try {
      new URL(urlString);
      return true;
    } catch (e) {
      return false;
    }
  };

  const handleAddUrl = () => {
    if (!currentUrlInput.trim()) {
      setError('URL cannot be empty.');
      return;
    }
    if (!isValidUrl(currentUrlInput)) {
      setError('Invalid URL format. Please include http:// or https://');
      return;
    }
    if (urls.length >= maxUrls) {
      setError(`You can add a maximum of ${maxUrls} URLs to the current group.`);
      return;
    }
    if (urls.includes(currentUrlInput)) {
      setError('This URL has already been added to the current group.');
      return;
    }
    onAddUrl(currentUrlInput);
    setCurrentUrlInput('');
    setError(null);
  };

  const handleAddNote = () => {
    if (!currentNoteInput.trim()) {
      setError('Note cannot be empty.');
      return;
    }
    onAddDocument({
      id: Date.now().toString(),
      name: `Note ${new Date().toLocaleDateString()}`,
      content: currentNoteInput
    });
    setCurrentNoteInput('');
    setError(null);
  };

  const activeGroupName = urlGroups.find(g => g.id === activeUrlGroupId)?.name || "Unknown Group";

  return (
    <div className="p-4 bg-[#1E1E1E] shadow-md rounded-xl h-full flex flex-col border border-[rgba(255,255,255,0.05)]">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold text-[#E2E2E2]">Knowledge Base URLs</h2>
        {onCloseSidebar && (
          <button
            onClick={onCloseSidebar}
            className="p-1 text-[#A8ABB4] hover:text-white rounded-md hover:bg-white/10 transition-colors md:hidden"
            aria-label="Close knowledge base"
          >
            <X size={24} />
          </button>
        )}
      </div>
      
      <div className="mb-3">
        <label htmlFor="url-group-select-kb" className="block text-sm font-medium text-[#A8ABB4] mb-1">
          Active URL Group
        </label>
        <div className="relative w-full">
          <select
            id="url-group-select-kb"
            value={activeUrlGroupId}
            onChange={(e) => onSetGroupId(e.target.value)}
            className="w-full py-2 pl-3 pr-8 appearance-none border border-[rgba(255,255,255,0.1)] bg-[#2C2C2C] text-[#E2E2E2] rounded-md focus:ring-1 focus:ring-white/20 focus:border-white/20 text-sm"
          >
            {urlGroups.map(group => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A8ABB4] pointer-events-none"
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <input
          type="url"
          value={currentUrlInput}
          onChange={(e) => setCurrentUrlInput(e.target.value)}
          placeholder="https://docs.example.com"
          className="flex-grow h-8 py-1 px-2.5 border border-[rgba(255,255,255,0.1)] bg-[#2C2C2C] text-[#E2E2E2] placeholder-[#777777] rounded-lg focus:ring-1 focus:ring-white/20 focus:border-white/20 transition-shadow text-sm"
          onKeyPress={(e) => e.key === 'Enter' && handleAddUrl()}
        />
        <button
          onClick={handleAddUrl}
          disabled={urls.length >= maxUrls}
          className="h-8 w-8 p-1.5 bg-white/[.12] hover:bg-white/20 text-white rounded-lg transition-colors disabled:bg-[#4A4A4A] disabled:text-[#777777] flex items-center justify-center"
          aria-label="Add URL"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium text-[#A8ABB4] mb-1">Quick Note</label>
        <div className="flex items-start gap-2">
          <textarea
            value={currentNoteInput}
            onChange={(e) => setCurrentNoteInput(e.target.value)}
            placeholder="Type a note to remember..."
            className="flex-grow h-16 py-1 px-2.5 border border-[rgba(255,255,255,0.1)] bg-[#2C2C2C] text-[#E2E2E2] placeholder-[#777777] rounded-lg focus:ring-1 focus:ring-white/20 focus:border-white/20 transition-shadow text-sm resize-none"
          />
          <button
            onClick={handleAddNote}
            disabled={!currentNoteInput.trim()}
            className="h-8 px-2.5 bg-white/[.12] hover:bg-white/20 text-white rounded-lg transition-colors disabled:bg-[#4A4A4A] disabled:text-[#777777] flex items-center justify-center text-xs font-medium mt-1"
          >
            Save
          </button>
        </div>
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium text-[#A8ABB4] mb-1">Upload Document</label>
        <input
          type="file"
          accept=".txt,.md"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = (event) => {
                const content = event.target?.result as string;
                onAddDocument({ id: Date.now().toString(), name: file.name, content });
              };
              reader.readAsText(file);
            }
          }}
          className="w-full text-sm text-[#A8ABB4] file:mr-4 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white/[.12] file:text-white hover:file:bg-white/20"
        />
      </div>
      {error && <p className="text-xs text-[#f87171] mb-2">{error}</p>}
      {urls.length >= maxUrls && <p className="text-xs text-[#fbbf24] mb-2">Maximum {maxUrls} URLs reached for this group.</p>}
      
      <div className="flex-grow overflow-y-auto space-y-2 chat-container">
        {urls.length === 0 && documents.length === 0 && (
          <p className="text-[#777777] text-center py-3 text-sm">Add documentation URLs or upload files to the group "{activeGroupName}" to start querying.</p>
        )}
        {urls.map((url) => (
          <div key={url} className="flex items-center justify-between p-2.5 bg-[#2C2C2C] border border-[rgba(255,255,255,0.05)] rounded-lg hover:shadow-sm transition-shadow">
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#79B8FF] hover:underline truncate" title={url}>
              {url}
            </a>
            <button 
              onClick={() => onRemoveUrl(url)}
              className="p-1 text-[#A8ABB4] hover:text-[#f87171] rounded-md hover:bg-[rgba(255,0,0,0.1)] transition-colors flex-shrink-0 ml-2"
              aria-label={`Remove ${url}`}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {documents.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between p-2.5 bg-[#2C2C2C] border border-[rgba(255,255,255,0.05)] rounded-lg hover:shadow-sm transition-shadow">
            <span className="text-xs text-[#E2E2E2] truncate" title={doc.name}>
              {doc.name}
            </span>
            <button 
              onClick={() => onRemoveDocument(doc.id)}
              className="p-1 text-[#A8ABB4] hover:text-[#f87171] rounded-md hover:bg-[rgba(255,0,0,0.1)] transition-colors flex-shrink-0 ml-2"
              aria-label={`Remove ${doc.name}`}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KnowledgeBaseManager;
