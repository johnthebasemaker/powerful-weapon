This folder should contain two files at runtime:

  1. main          (whisper.cpp binary; "main.exe" on Windows)
  2. ggml-large-v3.bin   (the Whisper large-v3 model, ~1.5 GB)

They are NOT shipped in the source repository because of size. The user
runs a one-time setup to download them — see ../../README.md.

Until both files are present, the Voice Inbox lets you import audio but
auto-grading is disabled.
