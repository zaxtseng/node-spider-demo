const puppeteer = require('puppeteer')

const url = 'https://paipai.jd.com/auction-detail/246516473?entryid=p0120003dbdnavi'


const requestUrl = async function(bool){
    //启动浏览器
    const browers = await puppeteer.launch({headless:bool})
    //启动新页面
    const page = await browers.newPage()
    //开启拦截器
    await page.setRequestInterception(true)
    await page.on('request', interceptedRequest => {
        //判断url是否以jpg或者png结尾,符合条件不再加载
        if(interceptedRequest.url().endsWith('.jpg') || interceptedRequest.url().endsWith('.png')){
            interceptedRequest.abort()
        }else{
            interceptedRequest.continue()
        }
    })
    
    //调整窗口大小
    await page.setViewport({
        width: 1920,
        height: 1080,
    })

    //连接网址
    await page.goto(url)
    const goods = page.$$eval('#auctionRecommend > div.mc > ul > li', e => {
        try {
            for(let i = 0; i < e.length; i ++){
                let n = e[i].querySelector('div.p-name').textContent
                if(n.includes('苹果')){
                    console.log("苹果")
                    return true
                }else{
                    console.log("无苹果")
                    return false
                }
            }
        }catch(error){
            console.log("error")
            return false
        }
    })
    
    
    if(!bool){
        return console.log('网页已打开,不要监控')
    }
    
    await goods.then(async b => {
        if(b){
            console.log("有货了")
            await page.waitForTimeout(2000)
            await browers.close()
            return requestUrl(false)
        }else{
            console.log("无货")
            console.log("三十分钟再试")
            await page.waitForTimeout(1800000)
            await browers.close()
            return requestUrl(true)
        }
    })
}


requestUrl(true)