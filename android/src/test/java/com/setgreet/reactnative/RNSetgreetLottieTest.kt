package com.setgreet.reactnative

import org.junit.Assert.assertTrue
import org.junit.Test

class RNSetgreetLottieTest {

  @Test
  fun `registerLottie returns true on Android, where the core SDK includes Lottie`() {
    assertTrue(moduleWithoutContext().registerLottie())
  }

  /**
   * The module's constructor needs a ReactApplicationContext, which a plain JVM
   * test cannot build (no Robolectric, no Mockito here). `registerLottie` reads
   * no module state, so an instance allocated without running the constructor
   * exercises the real method.
   */
  private fun moduleWithoutContext(): RNSetgreetModule {
    val unsafeClass = Class.forName("sun.misc.Unsafe")
    val field = unsafeClass.getDeclaredField("theUnsafe").apply { isAccessible = true }
    val unsafe = field.get(null)
    val allocate = unsafeClass.getMethod("allocateInstance", Class::class.java)
    return allocate.invoke(unsafe, RNSetgreetModule::class.java) as RNSetgreetModule
  }
}
