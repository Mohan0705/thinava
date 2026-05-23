import { NextRequest, NextResponse } from 'next/server'

/**
 * Image Upload API Route
 * Handles image uploads for restaurants and menu items
 * Returns: { success: boolean, imageUrl: string }
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF allowed' },
        { status: 400 }
      )
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum 5MB allowed' },
        { status: 400 }
      )
    }

    // Convert file to base64 for now (production should use actual cloud storage)
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const dataUrl = `data:${file.type};base64,${base64}`

    // TODO: In production, upload to Supabase Storage and return public URL:
    // const fileName = `${Date.now()}-${file.name}`
    // const { data, error } = await supabase.storage
    //   .from('images')
    //   .upload(fileName, file)
    // const imageUrl = supabase.storage
    //   .from('images')
    //   .getPublicUrl(fileName).data.publicUrl

    console.log('[IMAGE UPLOAD]', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      imageUrl: dataUrl,
      message: 'Image uploaded successfully. In production, this will be stored in Supabase Storage.',
    })
  } catch (error) {
    console.error('[IMAGE UPLOAD ERROR]', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
