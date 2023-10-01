const { default: axios } = require('axios')
const koa = require('koa')
const koaBodyParser = require('koa-bodyparser')
const koaJSON = require('koa-json')
const koaRouter = require('koa-router')

const logger = require('./base-log')('app', {
    level: 'debug',
    filename: 'mc',
})

const LISTEN_PORT = parseInt(process.env.LISTEN_PORT || '7062', 10)
const PRIMARY_SKIN_SERVER = process.env.PRIMARY_SKIN_SERVER

const app = new koa()
app.use(koaBodyParser())
app.use(koaJSON())

app.use(async (ctx, next) => {
    try {
        logger.info(`${ctx.request.ip} ${ctx.method} ${ctx.URL}`)
        logger.info(ctx.headers)

        const startTime = new Date()
        await next()
        logger.info(`${ctx.request.ip} ${ctx.method} ${ctx.URL} [${ctx.status}] (${new Date().getTime() - startTime.getTime()}ms)`)
    } catch (e) {
        logger.error(e)

        ctx.status = 500
        ctx.body = 'server internal error'
    }
})

app.use(async (ctx, next) => {
    if (ctx.method == 'GET') {
        const newURL = `https://${PRIMARY_SKIN_SERVER}${ctx.url}`

        logger.info(`[Proxy:GET] ${newURL}`)
        let res = await axios.get(newURL)
        logger.info(`[Proxy:GET] <${res.status}> ${newURL}`)
        logger.info(res.data)

        if (ctx.path == '/api/yggdrasil/sessionserver/session/minecraft/hasJoined' && res.status == 204) {
            logger.warn(`session not found with default skin server, fallback to Mojang Session Server: ${ctx.querystring}`)

            const newURL = `https://sessionserver.mojang.com/session/minecraft/hasJoined?${ctx.querystring}`
            logger.info(`[ProxyMojang:GET] ${newURL}`)
            res = await axios.get(newURL)
            logger.info(`[ProxyMojang:GET] <${res.status}> ${newURL}`)
            logger.info(res.data)
        }

        ctx.status = res.status
        ctx.body = res.data
        return
    }

    if (ctx.method == 'POST') {
        const newURL = `https://${PRIMARY_SKIN_SERVER}${ctx.url}`
        const postData = ctx.request.body

        logger.info(`[Proxy:POST] ${newURL}`)
        const res = await axios.post(newURL, postData)
        logger.info(`[Proxy:POST] <${res.status}> ${newURL}`)
        logger.info(res.data)

        ctx.status = res.status
        ctx.body = res.data
        return
    }
})

app.listen(LISTEN_PORT)
