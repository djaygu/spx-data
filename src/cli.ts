#!/usr/bin/env bun

import { BunRuntime } from '@effect/platform-bun'
import { main } from './cli/main'

BunRuntime.runMain(main(process.argv))
