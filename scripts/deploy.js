// node scripts/deploy.js dotenv_config_path=scripts/.env

import axios from 'axios'
import axios_throttle from 'axios-request-throttle'
import fs from 'fs'
import * as child from 'child_process'
import 'dotenv/config'

const AIRTABLE_API_TOKEN = process.env.AIRTABLE_API_TOKEN
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID
const AIRTABLE_TTL_SECONDS = process.env.AIRTABLE_TTL_SECONDS
const AUTHOR_FONT = process.env.AUTHOR_FONT
const AUTHOR_TEXT_COLOR = process.env.AUTHOR_TEXT_COLOR
const BACKGROUND = (String(process.env.TIDBYT_BACKGROUND).toLowerCase() === 'true')
const MAX_AGE = process.env.MAX_AGE
const MESSAGE_FONT  = process.env.MESSAGE_FONT
const MESSAGE_TEXT_COLOR = process.env.MESSAGE_TEXT_COLOR
const PRINT_LOG = (String(process.env.PRINT_LOG).toLowerCase() === 'true')
const RANDOM_MESSAGE = process.env.RANDOM_MESSAGE
const SHOW_UNICODE = process.env.SHOW_UNICODE
const TIDBYT_API_TOKEN = process.env.TIDBYT_API_TOKEN
const TIDBYT_APP_PATH = process.env.TIDBYT_APP_PATH
const TIDBYT_APP_NAME = process.env.TIDBYT_APP_NAME
const TIDBYT_DEVICE_ID = process.env.TIDBYT_DEVICE_ID
const TIDBYT_INSTALLATION_ID = process.env.TIDBYT_INSTALLATION_ID
const TIMEZONE = process.env.TIMEZONE

const axios_config = {
	headers: { Authorization: `Bearer ${TIDBYT_API_TOKEN}` }
}

axios_throttle.use(axios, { requestsPerSecond: AIRTABLE_TTL_SECONDS })

let previous_hash = ''
let installation_exists = false;

const push = () => {

	if (PRINT_LOG) console.log(Date())

	let render_pixlet = child.spawn('pixlet', ['render', `${TIDBYT_APP_PATH}/${TIDBYT_APP_NAME}.star`, `airtable_api_token=${AIRTABLE_API_TOKEN}`, `airtable_base_id=${AIRTABLE_BASE_ID}`, `airtable_table_id=${AIRTABLE_TABLE_ID}`, `airtable_ttl_seconds=${AIRTABLE_TTL_SECONDS}`, `max_age=${MAX_AGE}`, `random_message=${RANDOM_MESSAGE}`, `show_unicode=${SHOW_UNICODE}`, `author_font=${AUTHOR_FONT}`, `author_text_color=${AUTHOR_TEXT_COLOR}`, `message_font=${MESSAGE_FONT}`, `message_text_color=${MESSAGE_TEXT_COLOR}`, `timezone=${TIMEZONE}`, `print_log=${PRINT_LOG}`])

	render_pixlet.stdout.setEncoding('utf8')
	render_pixlet.stdout.on('data', (data) => {
		if (PRINT_LOG) console.log(data)
	})

	render_pixlet.on('close', (code) => {

		const webp = `${TIDBYT_APP_PATH}/${TIDBYT_APP_NAME}.webp`

		fs.readFile(webp, 'base64', (error, data) => {

			const file_size = fs.existsSync(webp) && fs.statSync(webp).size

			if (data !== previous_hash) {
				previous_hash = data

				if (file_size) {
					axios
						.post(
							`https://api.tidbyt.com/v0/devices/${TIDBYT_DEVICE_ID}/push`,
							{
								"image": data,
								"installationID": TIDBYT_INSTALLATION_ID,
								"background": BACKGROUND
							},
							axios_config
						)
						.then((response) => {
							if (PRINT_LOG) console.log(response.config.url)

							fs.existsSync(webp) && fs.unlink(webp, (error) => {
								if (error) console.error(error)
							})
						})
						.catch((error) => {
							console.error(error)
						})
				}

				else {
					axios
						.get(
							`https://api.tidbyt.com/v0/devices/${TIDBYT_DEVICE_ID}/installations`,
							axios_config
						)
						.then((response) => {
							if (PRINT_LOG) console.log(response.config.url)

							if (response.status == '200') {
								installation_exists = response.data.installations.some((installation => installation.id === TIDBYT_INSTALLATION_ID))

								if (installation_exists) {
									axios
										.delete(
											`https://api.tidbyt.com/v0/devices/${TIDBYT_DEVICE_ID}/installations/${TIDBYT_INSTALLATION_ID}`,
											axios_config
										)
										.then((response) => {
											if (PRINT_LOG) console.log(response.config.url)

											if (response.status == '200') {
												fs.existsSync(webp) && fs.unlink(webp, (error) => {
													if (error) console.error(error)
												})
												installation_exists = false;
											}
										})
										.catch((error) => {
											console.error(error)
										})
								}

							}
						})
						.catch((error) => {
							console.error(error)
						})
				}

			}

		})

	})

	render_pixlet.on('error', (error) => {
		console.error(error)
	})

}

const push_interval = setInterval(() => {
	push()
}, AIRTABLE_TTL_SECONDS * 1000)

push()
