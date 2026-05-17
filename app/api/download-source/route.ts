import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';

export async function GET() {
    try {
        const outputPath = '/tmp/haccp-pro-source.tar.gz';
        const workspacePath = process.cwd();

        execSync(
            `tar czf ${outputPath} ` +
            `--exclude='.git' ` +
            `--exclude='.next' ` +
            `--exclude='node_modules' ` +
            `--exclude='.local' ` +
            `--exclude='attached_assets' ` +
            `-C ${workspacePath} .`,
            { timeout: 30000 }
        );

        const fileBuffer = readFileSync(outputPath);

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/gzip',
                'Content-Disposition': `attachment; filename="haccp-pro-source-${new Date().toISOString().split('T')[0]}.tar.gz"`,
                'Content-Length': fileBuffer.length.toString(),
            },
        });
    } catch (error) {
        console.error('Download error:', error);
        return NextResponse.json({ error: 'Failed to create archive' }, { status: 500 });
    }
}
