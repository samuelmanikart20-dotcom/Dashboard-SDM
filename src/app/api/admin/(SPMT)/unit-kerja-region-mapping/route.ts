import { NextRequest, NextResponse } from 'next/server';
import { UNIT_KERJA_REGION_MAPPING } from '@/lib/unit-kerja-region-mapping';

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      mapping: UNIT_KERJA_REGION_MAPPING,
      message: 'Unit Kerja to Region mapping retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting unit kerja mapping:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get unit kerja mapping' },
      { status: 500 }
    );
  }
}
