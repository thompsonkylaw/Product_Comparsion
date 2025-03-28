import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { IconButton, Switch, FormControlLabel } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const Chat = () => {
  const apptitle = "產品比較助手4";
  const secondUserMessage = '';
  const useModeSwitch = true;
  const useServer = true;
  const firstPromptModel = "deepseek-reasoner";
  const secondPromptModel = "deepseek-chat";
  let server="";
  if (useServer) {
     server = "https://fastapi-production-98d5.up.railway.app/";
  }
  else{
     server = "http://localhost:8003/";
  }
  const systemPrompt = "用超級詳盡的方式比較, 例如要有基礎保單架構,核心保障差異,所有比較都是用表格形式顯示,最後要加上'備註\
                        以上資訊基於提供的 2024-2025年網上搜尋結果，部分內容可能與實際事件存在時間或細節差異。'";
  // const systemPrompt = "";
  const systemPrompt2 = "";                        
  // const systemPrompt2 = "我想將\
  //                       message\
  //                       資訊整理成Excel格式，您可以幫我把保單基本資訊、保障計劃信息和退保價值說明轉換成Excel表格嗎？ 格式如下: \
  //                       EXCEL 不能用行排列,因為打橫畫面看不到\
  //                       如modified_content\
  //                       有多個保障計劃名稱,每一個保障計劃名稱, 都必須顯示一個表格\
  //                       EXCEL的第一欄(column) 打直順序,一定要打直排欄(column),第二欄(column)是回答,次序如下:\
  //                       保單類型\
  //                       保險公司\
  //                       計劃名稱\
  //                       保單號碼\
  //                       主附加計劃\
  //                       保費繳付年期\
  //                       保單日期\
  //                       保費期滿日\
  //                       保額\
  //                       保障期\
  //                       繳費形式\
  //                       保單貨幣\
  //                       附加詳情\
  //                       如資料有退保價值說明,保證+非保證=總額請列出格式如下:\
  //                       EXCEL的第一欄(column) 打直順序,一定要打直排欄(column),第二欄(column)是回答,次序如下:\
  //                       現保單價值：: US/HK $\
  //                       65或66歲保單價值: US/HK $\
  //                       75或76歲保單價值: US/HK $\
  //                       85或86歲保單價值: US/HK $\
  //                       95或96歲保單價值: US/HK $\
  //                       整份保單現繳保費每年保費共多少:\
  //                       EXCEL的第一欄(column) 打直順序,一定要打直排欄(column),第二欄(column)是回答,次序如下:\
  //                       現繳保費每年\
  //                       其他有關保險的重要資料";
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fontData, setFontData] = useState(null);
  const [useChatApi, setUseChatApi] = useState(false);
  const [isFirstResponse, setIsFirstResponse] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const loadFont = async () => {
      try {
        const response = await fetch('/fonts/NotoSansCJKtc-Regular.ttf');
        if (!response.ok) throw new Error('Failed to fetch font file');
        const buffer = await response.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        setFontData(base64);
      } catch (error) {
        console.error('Failed to load font:', error);
      }
    };
    loadFont();
  }, []);

  const processContent = (content) => {
    const lines = content.split('\n');
    const blocks = [];
    let currentBlock = { type: 'text', data: [] };
    let inTable = false;

    lines.forEach((line) => {
      const isTableLine = line.trim().startsWith('|') && line.includes('|', 1);

      if (isTableLine) {
        if (!inTable) {
          if (currentBlock.data.length > 0) {
            blocks.push({ ...currentBlock, data: currentBlock.data.join('\n') });
          }
          currentBlock = { type: 'table', data: [] };
          inTable = true;
        }
        currentBlock.data.push(line.trim());
      } else {
        if (inTable) {
          blocks.push(currentBlock);
          currentBlock = { type: 'text', data: [] };
          inTable = false;
        }
        currentBlock.data.push(line);
      }
    });

    if (currentBlock.data.length > 0) {
      blocks.push({
        ...currentBlock,
        data: currentBlock.type === 'table' 
          ? currentBlock.data 
          : currentBlock.data.join('\n'),
      });
    }

    return blocks;
  };

  const parseTable = (tableLines) => {
    if (tableLines.length < 2) return { headers: [], body: [] };
    
    const filteredLines = tableLines.filter(line => !line.match(/^[\s|:-]+$/));
    const headers = filteredLines[0]
      .split('|')
      .slice(1, -1)
      .map(c => c.trim());
    const body = filteredLines.slice(1).map(line =>
      line.split('|')
        .slice(1, -1)
        .map(c => c.trim())
    );

    return { headers, body };
  };

  const generatePDF = (content) => {
    if (!fontData) {
      alert('字體正在加載中，請稍後再試');
      return;
    }

    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    doc.addFileToVFS('NotoSansCJKtc-Regular.ttf', fontData);
    doc.addFont('NotoSansCJKtc-Regular.ttf', 'NotoSansCJKtc', 'normal');
    doc.setFont('NotoSansCJKtc');

    const blocks = processContent(content);
    let yPosition = 20;

    const chineseSplit = (text, maxWidth = 190) => {
      const lines = [];
      let currentLine = '';
      
      text.split('').forEach((char) => {
        const testLine = currentLine + char;
        const testWidth = doc.getTextWidth(testLine);
        if (testWidth > maxWidth) {
          lines.push(currentLine);
          currentLine = char;
        } else {
          currentLine = testLine;
        }
      });
      lines.push(currentLine);
      return lines;
    };

    blocks.forEach((block) => {
      if (block.type === 'text') {
        const cleanedText = block.data
          .replace(/#{1,6}\s?/g, '')
          .replace(/\*\*/g, '')
          .replace(/\*/g, '')
          .replace(/`{3}[\s\S]*?`{3}/g, '')
          .replace(/-\s/g, '• ')
          .replace(/\[(.*?)\]\(.*?\)/g, '$1')
          .replace(/(?:\\[rn]|[\r\n]+)+/g, '\n')
          .replace(/<\/?[^>]+(>|$)/g, '');

        cleanedText.split('\n').forEach((paragraph) => {
          const lines = chineseSplit(paragraph);
          lines.forEach((line) => {
            if (yPosition > 280) {
              doc.addPage();
              yPosition = 20;
            }
            doc.setFontSize(8);
            doc.text(line, 15, yPosition);
            yPosition += 4;
          });
          yPosition += 4;
        });
      } else if (block.type === 'table') {
        const { headers, body } = parseTable(block.data);
        
        if (headers.length > 0 && body.length > 0) {
          autoTable(doc, {
            startY: yPosition,
            head: [headers],
            body: body,
            styles: {
              font: 'NotoSansCJKtc',
              fontSize: 8,
              cellPadding: 2,
              valign: 'middle',
              overflow: 'linebreak',
            },
            headStyles: {
              fillColor: [41, 128, 185],
              textColor: 255,
              fontStyle: 'normal'
            },
            margin: { left: 15 },
            theme: 'grid',
            didDrawPage: (data) => {
              yPosition = data.cursor.y + 10;
            }
          });
        }
      }
    });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.text(`頁面 ${i}/${totalPages}`, 190 - 10, 287, { align: 'right' });
    }

    const getHongKongTimestamp = () => {
      const now = new Date();
      const options = {
        timeZone: 'Asia/Hong_Kong',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      };
      const formatter = new Intl.DateTimeFormat('en-US', options);
      const [
        { value: month },,
        { value: day },,
        { value: year },,
        { value: hour },,
        { value: minute },,
        { value: second }
      ] = formatter.formatToParts(now);
      return `${year}${month}${day}_${hour}${minute}${second}`;
    };

    doc.save(`保單分析報告_${getHongKongTimestamp()}.pdf`);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const newMessages = [...messages, { role: 'user', content: inputMessage }];
    const messagesToSend = [
      { role: 'system', content: systemPrompt },
      ...newMessages,
    ];
    setMessages(newMessages);
    setInputMessage('');
    setIsLoading(true);

    try {
      const apiUrl = useChatApi
        ? server+'api/ppxty'
        : server+ 'api/dswithsearch';
        console.log("endpoint=",apiUrl);

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: messagesToSend,
            model: useChatApi ? 'r1-1776' : firstPromptModel
          }),
        });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Network response was not ok');
      }

      const data = await response.json();
      const assistantMessage = { role: 'assistant', content: data.message };
      const updatedMessages = [...newMessages, assistantMessage];
      setMessages(updatedMessages);

      if (isFirstResponse && systemPrompt2 !== '') {
        setIsFirstResponse(false);
        const followUpMessage = { role: 'user', content: secondUserMessage };
        const messagesWithFollowUp = [...updatedMessages, followUpMessage];
        const secondMessagesToSend = [
          { role: 'system', content: systemPrompt2 },
          ...messagesWithFollowUp,
        ];
        const secondResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: secondMessagesToSend,
            model: useChatApi ? 'r1-1776' : secondPromptModel
          }),
        });

        if (!secondResponse.ok) {
          const errorData = await secondResponse.json();
          throw new Error(errorData.detail || 'Network response was not ok');
        }

        const secondData = await secondResponse.json();
        const secondAssistantMessage = { role: 'assistant', content: secondData.message };
        setMessages([...messagesWithFollowUp, secondAssistantMessage]);
      }
    } catch (error) {
      console.error('Error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const resetChat = () => {
    setMessages([]);
    setIsFirstResponse(true);
  };

  const MarkdownComponents = {
    table: ({ children }) => (
      <div className="overflow-x-auto">
        <table className="markdown-table">{children}</table>
      </div>
    ),
  };

  return (
    <div className="App">
      <div className="header">
        <IconButton
          edge="start"
          color="inherit"
          aria-label="back"
          onClick={() => (window.location.href = 'https://portal.aimarketings.io/tool-list/')}
          sx={{ color: '#ffffff', marginRight: '16px' }}
        >
          <ArrowBackIcon />
        </IconButton>
        <h1>{apptitle}</h1>
      </div>

      <div className="chat-container">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.role === 'user' ? 'user' : 'assistant'}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
              {msg.content}
            </ReactMarkdown>
            {msg.role === 'assistant' && (
              <div className="pdf-button-container">
                <button
                  className="pdf-button"
                  onClick={() => generatePDF(msg.content)}
                  title="導出為PDF"
                  disabled={!fontData}
                >
                  📥 保存報告
                </button>
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="loading-text">
            保單分析助手 正在分析中
            <span className="dot">.</span>
            <span className="dot">.</span>
            <span className="dot">.</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-container">
        <form onSubmit={handleSubmit}>
          {useModeSwitch && (
            <div className="api-switch-container">
              <FormControlLabel
                control={
                  <Switch
                    checked={useChatApi}
                    onChange={(e) => setUseChatApi(e.target.checked)}
                    color="primary"
                  />
                }
                label="使用PPXTY"
                labelPlacement="start"
              />
            </div>
          )}
          
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={`請把2個保險產品名稱打貼上...${!useServer ? ' (local)' : ''}`}
            disabled={isLoading}
            className="message-input"
            rows={3}
          />
          <div className="button-group">
            <button type="submit" disabled={isLoading}>
              傳送
            </button>
            <button type="button" onClick={resetChat}>
              重置對話
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Chat;