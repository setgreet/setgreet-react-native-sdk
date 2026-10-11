package com.setgreet.reactnative

import java.util.concurrent.CountDownLatch
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import kotlin.coroutines.Continuation
import kotlin.coroutines.CoroutineContext
import kotlin.coroutines.EmptyCoroutineContext
import kotlin.coroutines.startCoroutine

/**
 * A suspend call driven with Kotlin's own coroutine primitives: [start] runs it
 * until it suspends, and whoever resumes it (an answer, a timeout, a teardown)
 * runs the rest on their own thread. Records every resumption, so a test can
 * prove a call settled exactly once.
 */
internal class Recording<T> : Continuation<T> {
  override val context: CoroutineContext = EmptyCoroutineContext

  private val settled = CountDownLatch(1)

  @Volatile
  var resumes = 0
    private set

  @Volatile
  private var outcome: Result<T>? = null

  override fun resumeWith(result: Result<T>) {
    resumes += 1
    outcome = result
    settled.countDown()
  }

  val isDone: Boolean
    get() = outcome != null

  /** Waits up to [timeoutMs] for the call to settle (calls resumed on another thread). */
  fun await(timeoutMs: Long): Boolean = settled.await(timeoutMs, TimeUnit.MILLISECONDS)

  fun value(): T = checkNotNull(outcome) { "the call has not settled" }.getOrThrow()

  fun failure(): Throwable =
    checkNotNull(checkNotNull(outcome) { "the call has not settled" }.exceptionOrNull()) {
      "the call succeeded"
    }
}

/** Starts [block] and returns its recording. */
internal fun <T> start(block: suspend () -> T): Recording<T> =
  Recording<T>().also { block.startCoroutine(it) }

/** A scheduler the test runs by hand: posted tasks in order, delayed tasks when told. */
internal class FakeScheduler : RNSetgreetScheduler {
  val posted = ArrayDeque<Runnable>()
  val delayed = mutableListOf<Pair<Runnable, Long>>()

  override fun post(task: Runnable) {
    posted.addLast(task)
  }

  override fun postDelayed(task: Runnable, delayMs: Long) {
    delayed += task to delayMs
  }

  override fun cancel(task: Runnable) {
    posted.remove(task)
    delayed.removeAll { it.first === task }
  }

  /** Runs the posted tasks in order, including any they post. */
  fun runPosted() {
    while (posted.isNotEmpty()) posted.removeFirst().run()
  }

  /** Runs every delayed task now, as if its delay had passed. */
  fun elapse() {
    val due = delayed.toList()
    delayed.clear()
    due.forEach { it.first.run() }
  }
}

/** A real-time scheduler on a background thread, for the one test that waits for a timeout. */
internal class ExecutorScheduler(private val executor: ScheduledExecutorService) : RNSetgreetScheduler {
  private val futures = mutableMapOf<Runnable, ScheduledFuture<*>>()

  override fun post(task: Runnable) {
    executor.execute(task)
  }

  @Synchronized
  override fun postDelayed(task: Runnable, delayMs: Long) {
    futures[task] = executor.schedule(task, delayMs, TimeUnit.MILLISECONDS)
  }

  @Synchronized
  override fun cancel(task: Runnable) {
    futures.remove(task)?.cancel(false)
  }
}

/** The module side of the bridge: records what it emits and can refuse. */
internal class FakeSender : RNSetgreetPurchaseBridge.Sender {
  var reachable = true
  var accepts = true
  val sent = mutableListOf<Map<String, Any?>>()

  override fun canReachJs(): Boolean = reachable

  override fun emitRequest(body: Map<String, Any?>): Boolean {
    if (!accepts) return false
    sent += body
    return true
  }

  /** The id of the request emitted last (or at [index]). */
  fun requestId(index: Int = sent.lastIndex): String = sent[index]["requestId"] as String
}
