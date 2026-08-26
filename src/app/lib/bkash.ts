import config from "../config";
import { redisClient } from "./redis";

export const getBkashIdToken = async () => {
	try {
		const ID_TOKEN_KEY = "bkash:idToken";
		const REFRESH_TOKEN_KEY = "bkash:refreshToken";

		let bkashIdToken = await redisClient.get(ID_TOKEN_KEY);
		const bkashIdTokenTTL = await redisClient.ttl(ID_TOKEN_KEY);

		let bkashRefreshToken = await redisClient.get(REFRESH_TOKEN_KEY);
		const bkashRefreshTokenTTL = await redisClient.ttl(REFRESH_TOKEN_KEY);


        console.log({
            bkashIdToken,
            bkashIdTokenTTL,
            bkashRefreshToken,
            bkashRefreshTokenTTL

        })
		// bkash id TOken remaining time is less thake equal 10
		if (
			(bkashIdTokenTTL <= 600 || !bkashIdToken) &&
			bkashRefreshToken &&
			bkashRefreshTokenTTL > 600
		) {
			const refreshTokenResponse = await fetch(
				`${config.bkash_base_url}/tokenized/checkout/token/refresh`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json",
						username: config.bkash_username,
						password: config.bkash_password,
					},
					body: JSON.stringify({
						app_key: config.bkash_app_key,
						app_secret: config.bkash_app_secret,
						refresh_token: bkashRefreshToken,
					}),
				},
			);

			const refreshResult = await refreshTokenResponse.json();

			console.log("bKash refresh response:", refreshResult);

			if (!refreshTokenResponse.ok || refreshResult.statusCode !== "0000") {
				throw new Error(
					`bKash token refresh failed: ${
						refreshResult.statusMessage || "Unknown error"
					}`,
				);
			}

			bkashIdToken = refreshResult.id_token as string;

			await redisClient.set(ID_TOKEN_KEY, bkashIdToken, {
				expiration: {
					type: "EX",
					value: 60 * 60,
				},
			});

			// if (refreshResult.refresh_token) {
			//     bkashRefreshToken = refreshResult.refresh_token;

			//     await redisClient.set(REFRESH_TOKEN_KEY,bkashRefreshToken as string,
			//         {
			//             expiration: {
			//                 type: "EX",
			//                 value: 60 * 60 * 24 * 28,
			//             },
			//         },
			//     );
			// }

			return bkashIdToken;
		}

		if (bkashIdTokenTTL > 600) {
			return bkashIdToken;
		}

		// 3. কোনো token নেই → নতুন token grant
		const response = await fetch(
			`${config.bkash_base_url}/tokenized/checkout/token/grant`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					username: config.bkash_username,
					password: config.bkash_password,
				},
				body: JSON.stringify({
					app_key: config.bkash_app_key,
					app_secret: config.bkash_app_secret,
				}),
			},
		);

		const result = await response.json();

		console.log("bKash grant response:", result);

		if (!response.ok || result.statusCode !== "0000") {
			throw new Error(
				`bKash Access Token Grant Failed: ${
					result.statusMessage || "Unknown error"
				}`,
			);
		}

		await redisClient.set(ID_TOKEN_KEY, result.id_token, {
			expiration: {
				type: "EX",
				value: 60 * 60,
			},
		});

		await redisClient.set(REFRESH_TOKEN_KEY, result.refresh_token, {
			expiration: {
				type: "EX",
				value: 60 * 60 * 24 * 28,
			},
		});

		return result.id_token;
	} catch (error: any) {
		console.error("bKash token error:", error);

		throw new Error(error.message);
	}
};
