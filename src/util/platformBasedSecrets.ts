// Remove import { Platform } from 'obsidian' and define a minimal Platform object.
import { b64 } from './b64';
import { crypt } from './crypt';

const Platform = {
	isMobile: /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
};

// cryptr requires node runtime and doesn't work on mobile
// Instead, use base64 encoding (not as safe, but obfuscates) on mobile.
const platformBasedSecrets = {
	decrypt: (str: string): string => {
		if (Platform.isMobile) {
			return b64.decode(str);
		} else {
			// Desktop
			return crypt.decrypt(str);
		}
	},
	encrypt: (str: string): string => {
		if (Platform.isMobile) {
			return b64.encode(str);
		} else {
			// Desktop
			return crypt.encrypt(str);
		}
	},
};

export { platformBasedSecrets };