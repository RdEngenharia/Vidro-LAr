import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export async function generateQuotePDF(elementId: string, filename: string = 'Orcamento.pdf'): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element #${elementId} not found`);
  }

  // Generate canvas with onclone callback to sanitize any Tailwind v4 oklch color functions
  const canvas = await html2canvas(element, {
    scale: 2, // 2x high resolution
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: 1024,
    onclone: (clonedDoc) => {
      // 1. Sanitize any <style> tags containing oklch definitions
      const styleTags = clonedDoc.querySelectorAll('style');
      styleTags.forEach((style) => {
        if (style.innerHTML && style.innerHTML.includes('oklch')) {
          // Replace oklch(...) occurrences with safe hex / rgb fallbacks
          style.innerHTML = style.innerHTML.replace(/oklch\([^)]+\)/gi, '#000000');
        }
      });

      // 2. Iterate through elements inside clonedDoc to convert any computed oklch inline styles to hex/rgb
      const allElements = clonedDoc.querySelectorAll('*');
      allElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        try {
          const computed = window.getComputedStyle(htmlEl);
          ['color', 'backgroundColor', 'borderColor', 'fill', 'stroke'].forEach((prop) => {
            const val = computed.getPropertyValue(prop);
            if (val && val.includes('oklch')) {
              if (prop === 'backgroundColor') {
                htmlEl.style.backgroundColor = '#ffffff';
              } else if (prop === 'borderColor') {
                htmlEl.style.borderColor = '#000000';
              } else if (prop === 'color') {
                htmlEl.style.color = '#000000';
              }
            }
          });
        } catch {
          // Ignore if style reading fails on detached node
        }
      });
    },
  });

  const imgData = canvas.toDataURL('image/png');
  
  // Create A4 PDF in portrait mode
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
  const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm

  // Apply clean 10mm page margins so content doesn't touch PDF edges
  const marginX = 10;
  const marginY = 10;
  const imgWidth = pdfWidth - marginX * 2; // 190mm wide content
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  pdf.addImage(imgData, 'PNG', marginX, marginY, imgWidth, imgHeight);

  pdf.save(filename);
}

export async function getQuotePDFFile(elementId: string, filename: string = 'Orcamento.pdf'): Promise<File> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element #${elementId} not found`);
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: 1024,
    onclone: (clonedDoc) => {
      const styleTags = clonedDoc.querySelectorAll('style');
      styleTags.forEach((style) => {
        if (style.innerHTML && style.innerHTML.includes('oklch')) {
          style.innerHTML = style.innerHTML.replace(/oklch\([^)]+\)/gi, '#000000');
        }
      });

      const allElements = clonedDoc.querySelectorAll('*');
      allElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        try {
          const computed = window.getComputedStyle(htmlEl);
          ['color', 'backgroundColor', 'borderColor', 'fill', 'stroke'].forEach((prop) => {
            const val = computed.getPropertyValue(prop);
            if (val && val.includes('oklch')) {
              if (prop === 'backgroundColor') {
                htmlEl.style.backgroundColor = '#ffffff';
              } else if (prop === 'borderColor') {
                htmlEl.style.borderColor = '#000000';
              } else if (prop === 'color') {
                htmlEl.style.color = '#000000';
              }
            }
          });
        } catch {
          // ignore
        }
      });
    },
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const marginX = 10;
  const marginY = 10;
  const imgWidth = pdfWidth - marginX * 2;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  pdf.addImage(imgData, 'PNG', marginX, marginY, imgWidth, imgHeight);

  const blob = pdf.output('blob');
  return new File([blob], filename, { type: 'application/pdf' });
}

export function printQuoteDirectly(elementId: string = 'pdf-quote-canvas') {
  const element = document.getElementById(elementId);
  if (!element) {
    try {
      window.print();
    } catch {
      alert('Selecione um orçamento para imprimir.');
    }
    return;
  }

  try {
    const printWin = window.open('', '_blank', 'width=900,height=1000');
    if (printWin) {
      const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map((s) => s.outerHTML)
        .join('\n');

      printWin.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Imprimir Orçamento Vidraçaria</title>
            ${styles}
            <style>
              @page { size: A4 portrait; margin: 8mm; }
              body {
                margin: 0;
                padding: 15px;
                background-color: #ffffff !important;
                color: #000000 !important;
                font-family: Arial, Helvetica, sans-serif;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              #pdf-quote-canvas {
                max-width: 100% !important;
                margin: 0 auto !important;
                box-shadow: none !important;
                border: 1px solid #000000 !important;
              }
            </style>
          </head>
          <body>
            <div style="max-width: 800px; margin: 0 auto;">
              ${element.outerHTML}
            </div>
            <script>
              setTimeout(function() {
                window.print();
              }, 400);
            </script>
          </body>
        </html>
      `);
      printWin.document.close();
      return;
    }
  } catch (err) {
    console.warn('Popup print attempt error:', err);
  }

  // Fallback if popup was blocked
  try {
    window.print();
  } catch {
    alert('O seu navegador bloqueou a janela de impressão. Por favor clique em "Baixar PDF" para salvar e imprimir o arquivo!');
  }
}

