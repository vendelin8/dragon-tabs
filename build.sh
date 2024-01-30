#!/bin/sh

if [ -f src.pem ]; then
    chromium --pack-extension=src --pack-extension-key=src.pem
else
    chromium --pack-extension=src
fi
