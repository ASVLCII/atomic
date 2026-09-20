use napi::{Status, bindgen_prelude::acquire_native_borrow};

// The removed vendored codegen patch made this check explicit at macro expansion
// sites for CodeQL #184, #185 and #186. Upstream performs it in the runtime helper.
// JS receiver rejection and wrapper lifetimes are exercised against the built
// addon by packages/coding-agent/test/napi-ownership-native.test.ts.
#[test]
fn upstream_native_borrows_reject_null_shared_and_mutable_values() {
	for mutable in [false, true] {
		let error = match acquire_native_borrow(std::ptr::null_mut::<u32>(), mutable) {
			Ok(_) => panic!("null native pointer was accepted"),
			Err(error) => error,
		};
		assert_eq!(error.status, Status::InvalidArg);
		assert_eq!(error.reason, "Cannot borrow a null native value");
	}
}

#[test]
fn upstream_native_borrows_reject_aliasing_and_release_on_drop() {
	let mut value = 1u32;
	let pointer = &raw mut value;
	let shared = acquire_native_borrow(pointer, false).unwrap();
	let second_shared = acquire_native_borrow(pointer, false).unwrap();
	assert!(acquire_native_borrow(pointer, true).is_err());
	drop(shared);
	assert!(acquire_native_borrow(pointer, true).is_err());
	drop(second_shared);

	let exclusive = acquire_native_borrow(pointer, true).unwrap();
	assert!(acquire_native_borrow(pointer, false).is_err());
	assert!(acquire_native_borrow(pointer, true).is_err());
	drop(exclusive);

	assert!(acquire_native_borrow(pointer, true).is_ok());
	assert!(acquire_native_borrow(pointer, false).is_ok());
}
