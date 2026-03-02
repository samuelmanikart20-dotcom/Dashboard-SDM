'use client';

import { useRef, useEffect, useState } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Tulis di sini...',
  rows = 6,
  className = '',
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState('14');
  const [fontColor, setFontColor] = useState('#000000');

  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      // Debug: cek apakah value mengandung list
      const hasListInValue = value.includes('<ul>') || value.includes('<ol>') || value.includes('<li>');
      if (hasListInValue) {
        console.log('RichTextEditor useEffect: List ditemukan di value, panjang:', value.length);
        console.log('Sample:', value.substring(0, 300));
      }
      
      // Set innerHTML dengan value
      editorRef.current.innerHTML = value;
      
      // Debug: cek apakah list masih ada setelah set innerHTML
      if (hasListInValue) {
        const hasListAfter = editorRef.current.innerHTML.includes('<ul>') || 
                            editorRef.current.innerHTML.includes('<ol>') || 
                            editorRef.current.innerHTML.includes('<li>');
        if (hasListAfter) {
          console.log('✅ RichTextEditor: List masih ada setelah set innerHTML');
        } else {
          console.error('❌ RichTextEditor: List HILANG setelah set innerHTML!');
          console.log('Value yang di-set:', value.substring(0, 500));
          console.log('innerHTML setelah set:', editorRef.current.innerHTML.substring(0, 500));
        }
      }
      
      // Set default color hitam HANYA untuk elemen yang tidak punya color style
      // JANGAN ubah warna yang sudah ada (yang sudah dipilih user)
      if (editorRef.current) {
        // Set default untuk editor container
        if (!editorRef.current.style.color) {
          editorRef.current.style.color = '#000000';
        }
        
        // Set default hitam untuk elemen yang tidak punya color atau warna putih/abu-abu
        // Tapi pastikan warna yang sudah dipilih user tetap
        const allElements = editorRef.current.querySelectorAll('*');
        allElements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          const styleColor = htmlEl.style.color;
          const computedColor = window.getComputedStyle(htmlEl).color;
          
          // Hanya set ke hitam jika:
          // 1. Tidak ada color style, ATAU
          // 2. Warna putih/abu-abu (yang tidak sengaja)
          const isWhiteOrGray = 
            styleColor === 'rgb(255, 255, 255)' || 
            styleColor === 'white' || 
            styleColor === '#ffffff' ||
            styleColor === 'rgb(128, 128, 128)' ||
            styleColor === 'gray' ||
            styleColor === '#808080' ||
            computedColor === 'rgb(128, 128, 128)' ||
            computedColor === 'rgb(156, 163, 175)' ||
            computedColor === 'rgb(229, 231, 235)' ||
            computedColor === 'rgb(255, 255, 255)';
          
          // Jika tidak ada color atau putih/abu-abu, set default hitam
          // TAPI jika sudah ada color yang valid (bukan putih/abu-abu), biarkan
          if (!styleColor || isWhiteOrGray) {
            htmlEl.style.color = '#000000';
            // Pastikan style color benar-benar di-set
            htmlEl.setAttribute('style', (htmlEl.getAttribute('style') || '') + ' color: #000000;');
          }
        });
        
        // Pastikan text nodes juga punya warna hitam
        const walker = document.createTreeWalker(
          editorRef.current,
          NodeFilter.SHOW_TEXT,
          null
        );
        let textNode;
        while (textNode = walker.nextNode()) {
          const parent = textNode.parentElement;
          if (parent) {
            const parentColor = parent.style.color;
            const parentComputed = window.getComputedStyle(parent).color;
            if (!parentColor || 
                parentColor === 'rgb(255, 255, 255)' || 
                parentColor === 'white' ||
                parentComputed === 'rgb(255, 255, 255)' ||
                parentComputed === 'rgb(128, 128, 128)' ||
                parentComputed === 'rgb(156, 163, 175)') {
              parent.style.color = '#000000';
              parent.setAttribute('style', (parent.getAttribute('style') || '') + ' color: #000000;');
            }
          }
        }
      }
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      // Ambil HTML lengkap termasuk list elements
      let html = editorRef.current.innerHTML;
      
      // Pastikan semua warna disimpan sebagai style inline
      // Konversi font[color] ke span[style="color: ..."]
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      
      const fontElements = tempDiv.querySelectorAll('font[color]');
      fontElements.forEach((fontEl) => {
        const htmlFont = fontEl as HTMLElement;
        const color = htmlFont.getAttribute('color');
        if (color) {
          const span = document.createElement('span');
          span.style.color = color;
          span.innerHTML = htmlFont.innerHTML;
          // Copy semua attributes kecuali color
          Array.from(htmlFont.attributes).forEach(attr => {
            if (attr.name !== 'color') {
              span.setAttribute(attr.name, attr.value);
            }
          });
          htmlFont.parentNode?.replaceChild(span, htmlFont);
        }
      });
      
      html = tempDiv.innerHTML;
      
      // Debug: cek apakah ada list
      if (html.includes('<ul>') || html.includes('<ol>') || html.includes('<li>')) {
        console.log('RichTextEditor: List ditemukan di HTML:', html.substring(0, 200));
      }
      
      // Debug: cek apakah ada warna
      if (html.includes('color:') || html.includes('style=')) {
        console.log('RichTextEditor: Warna ditemukan di HTML:', html.substring(0, 300));
      }
      
      onChange(html);
    }
  };

  const execCommand = (command: string, value: string | null = null) => {
    editorRef.current?.focus();
    const success = document.execCommand(command, false, value || undefined);
    if (!success) {
      console.warn(`Command ${command} failed`);
    }
    handleInput();
  };
  
  const insertList = (ordered: boolean) => {
    const editor = editorRef.current;
    if (!editor) return;
    
    // Focus editor terlebih dahulu
    editor.focus();
    
    // Tunggu sebentar untuk memastikan focus sudah aktif
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection) return;
      
      // Coba menggunakan execCommand dulu (cara standar)
      const command = ordered ? 'insertOrderedList' : 'insertUnorderedList';
      const success = document.execCommand(command, false, undefined);
      
      if (success) {
        // Jika berhasil, langsung update tanpa memaksa warna
        handleInput();
      } else {
        // Fallback: buat list secara manual
        let range: Range;
        if (selection.rangeCount > 0) {
          range = selection.getRangeAt(0);
        } else {
          // Buat range baru di akhir editor
          const currentEditor = editorRef.current;
          if (!currentEditor) return;
          range = document.createRange();
          range.selectNodeContents(currentEditor);
          range.collapse(false);
        }
        
        const listItem = document.createElement('li');
        
        if (range.collapsed) {
          // Jika cursor kosong, tambahkan non-breaking space
          listItem.textContent = '\u00A0';
        } else {
          // Jika ada selection, pindahkan ke list item
          try {
            const contents = range.extractContents();
            listItem.appendChild(contents);
          } catch {
            // Jika extractContents gagal, copy saja
            listItem.textContent = range.toString();
            range.deleteContents();
          }
        }
        
        const list = document.createElement(ordered ? 'ol' : 'ul');
        list.style.marginLeft = '20px';
        list.style.paddingLeft = '20px';
        list.appendChild(listItem);
        
        try {
          range.insertNode(list);
          // Set cursor di dalam list item
          range.setStart(listItem, 0);
          range.setEnd(listItem, listItem.textContent?.length || 0);
          selection.removeAllRanges();
          selection.addRange(range);
        } catch {
          // Jika insertNode gagal, append ke editor
          const currentEditor = editorRef.current;
          if (!currentEditor) return;
          currentEditor.appendChild(list);
          const newRange = document.createRange();
          newRange.setStart(listItem, 0);
          newRange.setEnd(listItem, listItem.textContent?.length || 0);
          selection.removeAllRanges();
          selection.addRange(newRange);
        }
        
        handleInput();
      }
    }, 10);
  };

  const changeFontSize = (size: string) => {
    setFontSize(size);
    editorRef.current?.focus();
    // Gunakan execCommand dengan formatBlock atau style
    document.execCommand('fontSize', false, '7'); // Font size 7 = custom size
    // Setelah execCommand, ubah style font yang baru dibuat
    setTimeout(() => {
      const fontElements = editorRef.current?.querySelectorAll('font[size="7"]');
      if (fontElements && fontElements.length > 0) {
        const lastFont = fontElements[fontElements.length - 1] as HTMLElement;
        lastFont.removeAttribute('size');
        lastFont.style.fontSize = `${size}px`;
        handleInput();
      } else {
        // Jika tidak ada font element, buat span dengan style
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          if (!range.collapsed) {
            const span = document.createElement('span');
            span.style.fontSize = `${size}px`;
            try {
              range.surroundContents(span);
              handleInput();
            } catch {
              // Fallback: insert span di cursor
              span.textContent = selection.toString();
              range.deleteContents();
              range.insertNode(span);
              handleInput();
            }
          }
        }
      }
    }, 10);
  };

  const changeFontColor = (color: string) => {
    setFontColor(color);
    editorRef.current?.focus();
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      // Jika tidak ada selection, gunakan execCommand untuk set warna
      document.execCommand('foreColor', false, color);
      handleInput();
      return;
    }
    
    const range = selection.getRangeAt(0);
    
    if (range.collapsed) {
      // Jika tidak ada selection, buat span untuk text berikutnya
      const span = document.createElement('span');
      span.style.color = color;
      try {
        range.insertNode(span);
        range.setStart(span, 0);
        range.setEnd(span, 0);
        selection.removeAllRanges();
        selection.addRange(range);
      } catch {
        document.execCommand('foreColor', false, color);
      }
      handleInput();
      return;
    }
    
    // Jika ada selection, wrap dengan span yang punya style color
    if (!selection) {
      document.execCommand('foreColor', false, color);
      handleInput();
      return;
    }
    
    try {
      // Coba wrap selection dengan span
      const span = document.createElement('span');
      span.style.color = color;
      range.surroundContents(span);
      handleInput();
    } catch {
      // Jika surroundContents gagal, gunakan execCommand dan kemudian konversi
      document.execCommand('foreColor', false, color);
      
      // Setelah execCommand, konversi font color ke style inline
      setTimeout(() => {
        if (!editorRef.current) return;
        
        // Cari semua elemen dengan color attribute atau font element
        const fontElements = editorRef.current.querySelectorAll('font[color], span[style*="color"]');
        fontElements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          const fontColor = htmlEl.getAttribute('color');
          
          if (fontColor) {
            // Konversi font color ke style inline
            htmlEl.style.color = fontColor;
            htmlEl.removeAttribute('color');
            // Jika elemen adalah font, ubah ke span
            if (htmlEl.tagName.toLowerCase() === 'font') {
              const span = document.createElement('span');
              span.innerHTML = htmlEl.innerHTML;
              span.style.color = fontColor;
              Array.from(htmlEl.attributes).forEach(attr => {
                if (attr.name !== 'color') {
                  span.setAttribute(attr.name, attr.value);
                }
              });
              htmlEl.parentNode?.replaceChild(span, htmlEl);
            }
          }
        });
        
        // Pastikan semua elemen dengan warna punya style inline
        const allElements = editorRef.current.querySelectorAll('*');
        allElements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          const computedColor = window.getComputedStyle(htmlEl).color;
          
          // Jika computed color bukan hitam dan bukan dari style attribute, set style
          if (computedColor && 
              computedColor !== 'rgb(0, 0, 0)' && 
              computedColor !== '#000000' &&
              !htmlEl.style.color) {
            htmlEl.style.color = computedColor;
          }
        });
        
        handleInput();
      }, 50);
    }
  };

  const insertLink = () => {
    const url = prompt('Masukkan URL:');
    if (url) {
      execCommand('createLink', url);
    }
  };

  const insertImage = () => {
    const url = prompt('Masukkan URL gambar:');
    if (url) {
      execCommand('insertImage', url);
    }
  };

  return (
    <div className={`border rounded-lg overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div
        ref={toolbarRef}
        className="bg-gray-100 border-b p-2 flex flex-wrap gap-1 items-center"
      >
        {/* Font Size */}
        <select
          value={fontSize}
          onChange={(e) => changeFontSize(e.target.value)}
          className="px-2 py-1 bg-white border rounded hover:bg-gray-50 text-sm text-black"
          title="Font Size"
        >
          <option value="8">8px</option>
          <option value="10">10px</option>
          <option value="12">12px</option>
          <option value="14">14px</option>
          <option value="16">16px</option>
          <option value="18">18px</option>
          <option value="20">20px</option>
          <option value="24">24px</option>
          <option value="28">28px</option>
          <option value="32">32px</option>
          <option value="36">36px</option>
        </select>

        {/* Font Color */}
        <div className="flex items-center gap-1">
          <label className="text-xs text-black px-1">Warna:</label>
          <input
            type="color"
            value={fontColor}
            onChange={(e) => changeFontColor(e.target.value)}
            className="w-8 h-7 bg-white border rounded cursor-pointer"
            title="Font Color"
          />
        </div>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Text Formatting */}
        <button
          type="button"
          onClick={() => execCommand('bold')}
          className="px-2 py-1 bg-white border rounded hover:bg-gray-50 text-sm font-bold text-black"
          title="Bold"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => execCommand('italic')}
          className="px-2 py-1 bg-white border rounded hover:bg-gray-50 text-sm italic text-black"
          title="Italic"
        >
          I
        </button>
        <button
          type="button"
          onClick={() => execCommand('underline')}
          className="px-2 py-1 bg-white border rounded hover:bg-gray-50 text-sm underline text-black"
          title="Underline"
        >
          U
        </button>
        <button
          type="button"
          onClick={() => execCommand('strikeThrough')}
          className="px-2 py-1 bg-white border rounded hover:bg-gray-50 text-sm line-through text-black"
          title="Strikethrough"
        >
          S
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Alignment */}
        <button
          type="button"
          onClick={() => execCommand('justifyLeft')}
          className="px-2 py-1 bg-white border rounded hover:bg-gray-50 text-sm text-black"
          title="Align Left"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => execCommand('justifyCenter')}
          className="px-2 py-1 bg-white border rounded hover:bg-gray-50 text-sm text-black"
          title="Align Center"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm2 4a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm-2 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm2 4a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => execCommand('justifyRight')}
          className="px-2 py-1 bg-white border rounded hover:bg-gray-50 text-sm text-black"
          title="Align Right"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 000 2h12a1 1 0 100-2H3zm0 4a1 1 0 000 2h12a1 1 0 100-2H3zm0 4a1 1 0 000 2h12a1 1 0 100-2H3zm0 4a1 1 0 000 2h12a1 1 0 100-2H3z" clipRule="evenodd" />
          </svg>
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Lists */}
        <button
          type="button"
          onClick={() => insertList(false)}
          className="px-2 py-1 bg-white border rounded hover:bg-gray-50 text-sm text-black font-bold"
          title="Bullet List (•)"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <circle cx="4" cy="4" r="1.5"/>
            <circle cx="4" cy="10" r="1.5"/>
            <circle cx="4" cy="16" r="1.5"/>
            <path d="M8 4h10v1.5H8V4zm0 6h10v1.5H8V10zm0 6h10v1.5H8V16z"/>
          </svg>
        </button>
        <button
          type="button"
          onClick={() => insertList(true)}
          className="px-2 py-1 bg-white border rounded hover:bg-gray-50 text-sm text-black font-bold"
          title="Numbered List (1. 2. 3. ...)"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <text x="2" y="6" fontSize="5" fill="currentColor" fontWeight="bold">1</text>
            <text x="2" y="12" fontSize="5" fill="currentColor" fontWeight="bold">2</text>
            <text x="2" y="18" fontSize="5" fill="currentColor" fontWeight="bold">3</text>
            <path d="M8 4h10v1.5H8V4zm0 6h10v1.5H8V10zm0 6h10v1.5H8V16z"/>
          </svg>
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Other */}
        <button
          type="button"
          onClick={insertLink}
          className="px-2 py-1 bg-white border rounded hover:bg-gray-50 text-sm text-black"
          title="Insert Link"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
          </svg>
        </button>
        <button
          type="button"
          onClick={insertImage}
          className="px-2 py-1 bg-white border rounded hover:bg-gray-50 text-sm text-black"
          title="Insert Image"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => execCommand('removeFormat')}
          className="px-2 py-1 bg-white border rounded hover:bg-gray-50 text-sm text-black"
          title="Remove Formatting"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={handleInput}
        className="w-full p-3 text-sm min-h-[120px] focus:outline-none"
        style={{
          minHeight: `${rows * 24}px`,
          color: '#000000',
        }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />

      <style dangerouslySetInnerHTML={{
        __html: `
          div[contenteditable][data-placeholder]:empty:before {
            content: attr(data-placeholder);
            color: #9ca3af;
            pointer-events: none;
          }
          div[contenteditable] {
            color: #000000;
          }
          div[contenteditable] ul,
          div[contenteditable] ol {
            margin-left: 20px;
            padding-left: 20px;
          }
          div[contenteditable] ul li,
          div[contenteditable] ol li {
            margin: 4px 0;
          }
          div[contenteditable] ul {
            list-style-type: disc;
          }
          div[contenteditable] ol {
            list-style-type: decimal;
          }
        `
      }} />
    </div>
  );
}


















