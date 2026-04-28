/* dreams-ffi: C ABI for the dreams-core Rust library.
 *
 * Intended consumers:
 *   - Android: loaded via System.loadLibrary("dreams_ffi") from Kotlin/JNI.
 *   - iOS:     linked as a static library (`libdreams_ffi.a`) or dynamic
 *              framework, then called from Swift via the standard C-interop.
 *   - Flutter: accessed through `dart:ffi` using DynamicLibrary.open().
 *
 * Threading: DreamsContext is internally synchronised (the SQLite connection
 * sits behind a Mutex). `dreams_call` is safe to call from any thread, but
 * will serialise on the mutex. For UI responsiveness, invoke from a
 * background thread / isolate / coroutine.
 *
 * Memory: every `char*` returned by this library must be freed with
 * `dreams_free_string`. Do not free with the host's `free()`.
 */

#ifndef DREAMS_FFI_H
#define DREAMS_FFI_H

#ifdef __cplusplus
extern "C" {
#endif

typedef struct DreamsContext DreamsContext;

/* Open (or create) the SQLite database at `db_path` and run migrations.
 * Returns NULL on error. */
DreamsContext *dreams_open(const char *db_path);

/* Release the context and close the database. Safe to call on NULL. */
void dreams_close(DreamsContext *ctx);

/* Invoke a core method by name. Returns a heap-allocated UTF-8 JSON string
 * of the shape {"ok": true, "result": ...} or {"ok": false, "error": "..."}.
 * Free with `dreams_free_string`. Returns NULL only if inputs are invalid. */
char *dreams_call(DreamsContext *ctx, const char *method, const char *args_json);

/* Free a string previously returned by this library. */
void dreams_free_string(char *s);

#ifdef __cplusplus
}
#endif

#endif /* DREAMS_FFI_H */
