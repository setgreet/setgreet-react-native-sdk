package com.setgreet.reactnative

import com.setgreet.purchases.SetgreetPaywallImpressionContext
import com.setgreet.purchases.SetgreetPurchaseAccessState
import com.setgreet.purchases.SetgreetPurchaseError
import com.setgreet.purchases.SetgreetPurchaseErrorCode
import com.setgreet.purchases.SetgreetPurchaseIntroOffer
import com.setgreet.purchases.SetgreetPurchasePeriod
import com.setgreet.purchases.SetgreetPurchasePeriodUnit
import com.setgreet.purchases.SetgreetPurchaseSource
import com.setgreet.purchases.SetgreetPurchaseStatus
import com.setgreet.purchases.SetgreetRestoreStatus
import java.math.BigDecimal
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Decoding what JS answers, as `ReadableMap.toHashMap()` hands it over: numbers
 * are `Double`, objects `Map`, arrays `List`.
 */
class RNSetgreetPurchaseCodingTest {

  private fun product(vararg overrides: Pair<String, Any?>): Map<String, Any?> = mapOf(
    "ref" to "\$rc_annual",
    "storeProductId" to "com.app.annual",
    "localizedPrice" to "\$49.99",
    "priceAmount" to 49.99,
    "currencyCode" to "USD"
  ) + overrides

  private fun price(value: Any?): BigDecimal? =
    RNSetgreetPurchaseCoding.product(product("priceAmount" to value))?.priceAmount

  @Test
  fun `priceAmount becomes its exact shortest decimal`() {
    assertEquals(BigDecimal("49.99"), price(49.99))
    assertEquals(BigDecimal("0.99"), price(0.99))
    assertEquals(0, BigDecimal("1299").compareTo(price(1299.0)))
    assertEquals(BigDecimal("1299"), price(1299))
    assertEquals(BigDecimal("49.99"), price("49.99"))
    assertNotEquals("never the binary expansion of the double", BigDecimal(49.99), price(49.99))
  }

  @Test
  fun `a product without a ref or a numeric price is dropped`() {
    val products = RNSetgreetPurchaseCoding.products(
      listOf(
        product(),
        product("ref" to null),
        product("ref" to ""),
        product("ref" to 7.0),
        product("priceAmount" to null),
        product("priceAmount" to "abc"),
        product("priceAmount" to true),
        product("priceAmount" to Double.NaN),
        product("priceAmount" to Double.POSITIVE_INFINITY),
        "not a product",
        null
      )
    )

    assertEquals(listOf("\$rc_annual"), products.map { it.ref })
    assertTrue(RNSetgreetPurchaseCoding.products(null).isEmpty())
    assertTrue(RNSetgreetPurchaseCoding.products(product()).isEmpty())
  }

  @Test
  fun `missing optional product fields get safe defaults`() {
    val decoded = RNSetgreetPurchaseCoding.product(mapOf("ref" to "\$rc_monthly", "priceAmount" to 4.99))!!

    assertEquals("", decoded.storeProductId)
    assertEquals("", decoded.localizedPrice)
    assertEquals("", decoded.currencyCode)
    assertNull(decoded.title)
    assertNull(decoded.description)
    assertNull(decoded.period)
    assertNull(decoded.introOffer)
  }

  @Test
  fun `period and intro offer are validated`() {
    val decoded = RNSetgreetPurchaseCoding.product(
      product(
        "period" to mapOf("unit" to "year", "count" to 1.0),
        "introOffer" to mapOf("type" to "trial", "periodText" to "7 days", "eligible" to true)
      )
    )!!
    assertEquals(SetgreetPurchasePeriod(SetgreetPurchasePeriodUnit.YEAR, 1), decoded.period)
    assertEquals(SetgreetPurchaseIntroOffer("trial", null, "7 days", true), decoded.introOffer)

    listOf(
      mapOf("unit" to "lifetime", "count" to 1.0),
      mapOf("unit" to "month", "count" to 0.0),
      mapOf("unit" to "month", "count" to 1.5),
      mapOf("unit" to "month"),
      "P1M"
    ).forEach { period ->
      assertNull(RNSetgreetPurchaseCoding.product(product("period" to period))!!.period)
    }
    assertNull(RNSetgreetPurchaseCoding.product(product("introOffer" to mapOf("eligible" to true)))!!.introOffer)
    assertNull(
      RNSetgreetPurchaseCoding.product(
        product("introOffer" to mapOf("type" to "trial", "eligible" to "yes"))
      )!!.introOffer!!.eligible
    )
  }

  @Test
  fun `an unknown or missing purchase status is failed with unknown`() {
    val unknown = RNSetgreetPurchaseCoding.purchaseResult(mapOf("status" to "done"), "\$rc_annual")
    val missing = RNSetgreetPurchaseCoding.purchaseResult(emptyMap(), "\$rc_annual")

    listOf(unknown, missing).forEach { result ->
      assertEquals(SetgreetPurchaseStatus.FAILED, result.status)
      assertEquals(SetgreetPurchaseErrorCode.UNKNOWN, result.error?.code)
      assertEquals("\$rc_annual", result.productRef)
      assertTrue(result.accessRefs.isEmpty())
    }
  }

  @Test
  fun `purchase results keep their status, refs and error`() {
    val purchased = RNSetgreetPurchaseCoding.purchaseResult(
      mapOf("status" to "purchased", "productRef" to "\$rc_annual", "accessRefs" to listOf("premium", 3.0, null)),
      "\$rc_other"
    )
    val cancelled = RNSetgreetPurchaseCoding.purchaseResult(
      mapOf("status" to "cancelled", "error" to mapOf("code" to "purchase_cancelled")),
      "\$rc_annual"
    )
    val pending = RNSetgreetPurchaseCoding.purchaseResult(
      mapOf("status" to "pending", "error" to mapOf("code" to "purchase_pending")),
      "\$rc_annual"
    )

    assertEquals(SetgreetPurchaseStatus.PURCHASED, purchased.status)
    assertEquals("\$rc_annual", purchased.productRef)
    assertEquals(listOf("premium"), purchased.accessRefs)
    assertNull(purchased.error)
    assertEquals(SetgreetPurchaseStatus.CANCELLED, cancelled.status)
    assertEquals(SetgreetPurchaseErrorCode.PURCHASE_CANCELLED, cancelled.error?.code)
    assertEquals(SetgreetPurchaseStatus.PENDING, pending.status)
    assertEquals(SetgreetPurchaseErrorCode.PURCHASE_PENDING, pending.error?.code)
  }

  @Test
  fun `restore results are decoded and missing arrays are empty`() {
    val unknown = RNSetgreetPurchaseCoding.restoreResult(mapOf("status" to "done"))
    val nothing = RNSetgreetPurchaseCoding.restoreResult(mapOf("status" to "nothingToRestore"))
    val restored = RNSetgreetPurchaseCoding.restoreResult(mapOf("status" to "restored", "accessRefs" to listOf("pro")))

    assertEquals(SetgreetRestoreStatus.FAILED, unknown.status)
    assertEquals(SetgreetPurchaseErrorCode.UNKNOWN, unknown.error?.code)
    assertEquals(SetgreetRestoreStatus.NOTHING_TO_RESTORE, nothing.status)
    assertTrue(nothing.accessRefs.isEmpty())
    assertEquals(SetgreetRestoreStatus.RESTORED, restored.status)
    assertEquals(listOf("pro"), restored.accessRefs)
  }

  @Test
  fun `access state is null when absent and active follows the refs when missing`() {
    assertNull(RNSetgreetPurchaseCoding.accessState(null))
    assertNull(RNSetgreetPurchaseCoding.accessState("yes"))
    assertEquals(
      SetgreetPurchaseAccessState(true, listOf("pro")),
      RNSetgreetPurchaseCoding.accessState(mapOf("accessRefs" to listOf("pro")))
    )
    assertEquals(
      SetgreetPurchaseAccessState(false, emptyList()),
      RNSetgreetPurchaseCoding.accessState(emptyMap<String, Any?>())
    )
    assertEquals(
      SetgreetPurchaseAccessState(false, listOf("pro")),
      RNSetgreetPurchaseCoding.accessState(mapOf("active" to false, "accessRefs" to listOf("pro")))
    )
  }

  @Test
  fun `errors keep known codes and turn a numeric providerCode into a string`() {
    assertEquals(
      SetgreetPurchaseError(SetgreetPurchaseErrorCode.NETWORK_ERROR, "E_OFFLINE", "offline"),
      RNSetgreetPurchaseCoding.decodeError(
        mapOf("code" to "network_error", "providerCode" to "E_OFFLINE", "message" to "offline")
      )
    )
    assertEquals(SetgreetPurchaseErrorCode.UNKNOWN, RNSetgreetPurchaseCoding.decodeError(mapOf("code" to "bogus")).code)
    assertEquals(SetgreetPurchaseErrorCode.UNKNOWN, RNSetgreetPurchaseCoding.decodeError(emptyMap<String, Any?>()).code)
    assertEquals("10", RNSetgreetPurchaseCoding.decodeError(mapOf("providerCode" to 10.0)).providerCode)
    assertEquals("10.5", RNSetgreetPurchaseCoding.decodeError(mapOf("providerCode" to 10.5)).providerCode)
    assertEquals("3", RNSetgreetPurchaseCoding.decodeError(mapOf("providerCode" to 3)).providerCode)
    assertNull(RNSetgreetPurchaseCoding.decodeError(mapOf("providerCode" to Double.NaN)).providerCode)
    assertNull(RNSetgreetPurchaseCoding.decodeError(mapOf("providerCode" to true)).providerCode)
  }

  @Test
  fun `a missing or empty default source reads as the current offering`() {
    assertEquals(SetgreetPurchaseSource.currentOffering, RNSetgreetPurchaseCoding.source(null))
    assertEquals(
      SetgreetPurchaseSource.currentOffering,
      RNSetgreetPurchaseCoding.source(mapOf("sourceType" to "", "sourceId" to ""))
    )
    assertEquals(
      SetgreetPurchaseSource.offering("onboarding"),
      RNSetgreetPurchaseCoding.source(mapOf("sourceType" to "offering", "sourceId" to "onboarding"))
    )
  }

  @Test
  fun `native values encode as plain maps with explicit nulls`() {
    assertEquals(
      mapOf("sourceType" to "current_offering", "sourceId" to null),
      RNSetgreetPurchaseCoding.encode(SetgreetPurchaseSource.currentOffering)
    )
    assertEquals(
      mapOf("code" to "network_error", "providerCode" to "timeout", "message" to null),
      RNSetgreetPurchaseCoding.encode(SetgreetPurchaseError(SetgreetPurchaseErrorCode.NETWORK_ERROR, "timeout"))
    )
    assertEquals(
      mapOf(
        "flowId" to "flow-1",
        "screenId" to "screen-1",
        "source" to mapOf("sourceType" to "placement", "sourceId" to "main"),
        "productRefs" to listOf("\$rc_annual", "\$rc_monthly")
      ),
      RNSetgreetPurchaseCoding.encode(
        SetgreetPaywallImpressionContext(
          "flow-1",
          "screen-1",
          SetgreetPurchaseSource.placement("main"),
          listOf("\$rc_annual", "\$rc_monthly")
        )
      )
    )
  }
}
