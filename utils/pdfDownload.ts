export const savePdfForPWA = (pdf: any, filename: string) => {
  try {
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      const newWindow = window.open(url, '_blank');
      if (!newWindow) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 250);
      } else {
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 250);
    }
  } catch {
    pdf.save(filename);
  }
};
