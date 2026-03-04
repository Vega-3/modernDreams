use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;

/// Recognise handwritten text in a base64-encoded image.
///
/// Uses the Windows OCR engine (Windows.Media.Ocr), which is built into
/// Windows 10/11 and handles handwriting far better than Tesseract.
///
/// The operation is run on a dedicated blocking thread so Tokio is not stalled.
#[tauri::command]
pub async fn recognize_handwriting(image_base64: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || run_ocr(&image_base64))
        .await
        .map_err(|e| e.to_string())?
}

// ─── Windows implementation ───────────────────────────────────────────────────

#[cfg(target_os = "windows")]
fn run_ocr(image_base64: &str) -> Result<String, String> {
    use windows::{
        core::Interface,
        Foundation::{AsyncOperationCompletedHandler, IAsyncOperation},
        Graphics::Imaging::{BitmapDecoder, BitmapPixelFormat, SoftwareBitmap},
        Media::Ocr::OcrEngine,
        Storage::Streams::{DataWriter, InMemoryRandomAccessStream},
        Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED},
    };

    // Initialise COM/WinRT for this blocking thread.
    // Tauri's Tokio threads don't have a COM apartment; we need MTA.
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
    }

    // -------------------------------------------------------------------
    // Helper: convert a WinRT IAsyncOperation<T> into a synchronous call.
    //
    // WinRT's IAsyncOperation<T> does not implement std::future::Future in
    // windows-rs 0.58, so we synchronise with a channel instead.
    // -------------------------------------------------------------------
    fn block_on<T: windows::core::RuntimeType + 'static>(
        op: IAsyncOperation<T>,
    ) -> windows::core::Result<T> {
        let (tx, rx) = std::sync::mpsc::channel::<()>();
        op.SetCompleted(&AsyncOperationCompletedHandler::new(move |_, _| {
            let _ = tx.send(());
            Ok(())
        }))?;
        // recv() returns Err only if the sender was dropped without sending,
        // which can't happen here because the closure always sends before dropping.
        let _ = rx.recv();
        op.GetResults()
    }

    let w = |e: windows::core::Error| e.to_string();

    let bytes = B64.decode(image_base64).map_err(|e| e.to_string())?;

    // -------------------------------------------------------------------
    // Write the image bytes into a WinRT in-memory random-access stream.
    // -------------------------------------------------------------------
    let stream = InMemoryRandomAccessStream::new().map_err(w)?;

    // GetOutputStreamAt gives an IOutputStream at byte position 0.
    let output = stream.GetOutputStreamAt(0).map_err(w)?;
    let writer = DataWriter::CreateDataWriter(&output).map_err(w)?;
    writer.WriteBytes(&bytes).map_err(w)?;

    // StoreAsync returns DataWriterStoreOperation; cast to IAsyncOperation<u32>.
    let store_op: IAsyncOperation<u32> = writer.StoreAsync().map_err(w)?.cast().map_err(w)?;
    block_on(store_op).map_err(w)?;

    // Detach so the writer's drop doesn't close the underlying stream.
    writer.DetachStream().map_err(w)?;
    drop(output);

    // Seek to position 0 so the decoder reads from the start.
    stream.Seek(0).map_err(w)?;

    // -------------------------------------------------------------------
    // Decode the image into a SoftwareBitmap.
    // BitmapDecoder auto-detects PNG/JPEG/BMP/TIFF/etc.
    // -------------------------------------------------------------------
    let decoder_op = BitmapDecoder::CreateAsync(&stream).map_err(w)?;
    let decoder = block_on(decoder_op).map_err(w)?;

    let bitmap_op = decoder.GetSoftwareBitmapAsync().map_err(w)?;
    let bitmap = block_on(bitmap_op).map_err(w)?;

    // Windows OCR requires Bgra8 pixel format; convert if the image uses another.
    let bitmap = if bitmap.BitmapPixelFormat().map_err(w)? != BitmapPixelFormat::Bgra8 {
        SoftwareBitmap::Convert(&bitmap, BitmapPixelFormat::Bgra8).map_err(w)?
    } else {
        bitmap
    };

    // -------------------------------------------------------------------
    // Run the Windows OCR engine.
    // TryCreateFromUserProfileLanguages picks the user's preferred language
    // (English on most English-locale Windows installs).
    // -------------------------------------------------------------------
    let engine = OcrEngine::TryCreateFromUserProfileLanguages().map_err(w)?;

    let ocr_op = engine.RecognizeAsync(&bitmap).map_err(w)?;
    let result = block_on(ocr_op).map_err(w)?;

    // Collect individual lines so we preserve natural line breaks.
    let lines = result.Lines().map_err(w)?;
    let count = lines.Size().map_err(w)?;

    let mut out = Vec::with_capacity(count as usize);
    for i in 0..count {
        let line = lines.GetAt(i).map_err(w)?;
        out.push(line.Text().map_err(w)?.to_string());
    }

    Ok(out.join("\n"))
}

// ─── Non-Windows stub ─────────────────────────────────────────────────────────

#[cfg(not(target_os = "windows"))]
fn run_ocr(_image_base64: &str) -> Result<String, String> {
    Err(
        "Handwriting recognition is only supported on Windows \
         (uses the built-in Windows OCR engine)."
            .to_string(),
    )
}
