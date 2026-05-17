export interface PdfHeaderOptions {
    unitName: string;
    registryTitle: string;
    subtitle?: string;
    logoSrc?: string | null;
    docControlData: {
        docRef: string;
        version: string;
        effectiveDate: string;
    };
    compact?: boolean;
}

export function drawPdfHeader(
    pdf: any,
    startY: number,
    ml: number,
    mr: number,
    pw: number,
    opts: PdfHeaderOptions
): number {
    const H = opts.compact ? 48 : 60;
    const cw = pw - ml - mr;
    const accentW = 4;
    const logoBoxW = 62;
    const docW = 130;
    const textX = ml + accentW + logoBoxW + 10;
    const dcX = pw - mr - docW;
    const rowH = H / 3;

    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(30, 41, 59);
    pdf.setLineWidth(1.5);
    pdf.rect(ml, startY, cw, H);

    pdf.setFillColor(79, 70, 229);
    pdf.rect(ml, startY, accentW, H, 'F');

    pdf.setFillColor(249, 250, 251);
    pdf.rect(ml + accentW, startY, logoBoxW, H, 'F');

    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.5);
    pdf.line(ml + accentW + logoBoxW, startY, ml + accentW + logoBoxW, startY + H);

    if (opts.logoSrc) {
        try {
            const isJpeg = opts.logoSrc.startsWith('data:image/jpeg') || opts.logoSrc.startsWith('data:image/jpg');
            const format = isJpeg ? 'JPEG' : 'PNG';
            const pad = 8;
            const imgSide = logoBoxW - pad * 2;
            const imgY = startY + (H - imgSide) / 2;
            pdf.addImage(opts.logoSrc, format, ml + accentW + pad, imgY, imgSide, imgSide, undefined, 'FAST');
        } catch (_) {}
    }

    const nameFontSize = opts.compact ? 11 : 13;
    const titleFontSize = opts.compact ? 8 : 9;
    const subFontSize = opts.compact ? 6.5 : 7.5;

    const nameY = startY + (opts.subtitle ? H * 0.35 : H * 0.44);
    const titleY = startY + (opts.subtitle ? H * 0.58 : H * 0.44 + nameFontSize + 4);
    const subY   = startY + H * 0.82;

    pdf.setFontSize(nameFontSize);
    pdf.setTextColor(15, 23, 42);
    pdf.setFont('helvetica', 'bold');
    pdf.text(opts.unitName, textX, nameY);

    pdf.setFontSize(titleFontSize);
    pdf.setTextColor(79, 70, 229);
    pdf.setFont('helvetica', 'bold');
    pdf.text(opts.registryTitle, textX, titleY);

    if (opts.subtitle) {
        pdf.setFontSize(subFontSize);
        pdf.setTextColor(100, 116, 139);
        pdf.setFont('helvetica', 'normal');
        pdf.text(opts.subtitle, textX, subY);
    }

    pdf.setFillColor(248, 250, 252);
    pdf.rect(dcX, startY, docW, H, 'F');
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.5);
    pdf.line(dcX, startY, dcX, startY + H);

    const labels = ['Doc Ref:', 'Revision:', 'Effective:'];
    const values = [opts.docControlData.docRef, `v${opts.docControlData.version}`, opts.docControlData.effectiveDate];
    const labelColW = 52;

    for (let i = 0; i < 3; i++) {
        const ry = startY + i * rowH;
        if (i < 2) {
            pdf.setDrawColor(226, 232, 240);
            pdf.line(dcX, ry + rowH, dcX + docW, ry + rowH);
        }
        pdf.setDrawColor(226, 232, 240);
        pdf.line(dcX + labelColW, ry, dcX + labelColW, ry + rowH);

        pdf.setFontSize(opts.compact ? 6.5 : 7);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(100, 116, 139);
        pdf.text(labels[i], dcX + 5, ry + rowH / 2 + 2.5);

        pdf.setTextColor(15, 23, 42);
        pdf.text(values[i], dcX + labelColW + 5, ry + rowH / 2 + 2.5);
    }

    return startY + H + 10;
}

export function resolveEntityLogoSrc(entities: any[], userRootId?: string | null): string | null {
    if (!entities?.length || !userRootId) return null;
    const unit = entities.find((e: any) => e.id === userRootId);
    if (!unit) return null;
    if (unit.logoSrc) return unit.logoSrc;
    const regional = unit.parentId ? entities.find((e: any) => e.id === unit.parentId) : null;
    if (regional?.logoSrc) return regional.logoSrc;
    const corporate = regional?.parentId ? entities.find((e: any) => e.id === regional.parentId) : null;
    return corporate?.logoSrc || null;
}
