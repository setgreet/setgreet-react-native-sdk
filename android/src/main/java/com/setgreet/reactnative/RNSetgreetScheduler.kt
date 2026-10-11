package com.setgreet.reactnative

import android.os.Handler
import android.os.Looper

/**
 * Hands work to a thread later: the purchase bridge's timeouts. An interface so
 * the bridge runs in plain JVM unit tests, which have no Looper; production
 * uses [RNSetgreetMainThreadScheduler].
 */
internal interface RNSetgreetScheduler {
  /** Runs [task] on the scheduler's thread, after the tasks posted before it. */
  fun post(task: Runnable)

  /** Runs [task] on the scheduler's thread after [delayMs]. */
  fun postDelayed(task: Runnable, delayMs: Long)

  /** Drops [task] if it has not run yet. */
  fun cancel(task: Runnable)
}

/** The main thread, through a [Handler] on the main Looper (created on first use). */
internal object RNSetgreetMainThreadScheduler : RNSetgreetScheduler {
  private val handler by lazy { Handler(Looper.getMainLooper()) }

  override fun post(task: Runnable) {
    handler.post(task)
  }

  override fun postDelayed(task: Runnable, delayMs: Long) {
    handler.postDelayed(task, delayMs)
  }

  override fun cancel(task: Runnable) {
    handler.removeCallbacks(task)
  }
}
