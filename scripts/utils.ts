import fs from "fs"
import path from "path"
import readline from "readline"
import util from "util"

export const unixtimestamp = () => Math.round(Date.now() / 1000)
export const dateSlug = (d?: Date) => (d || new Date()).toISOString().replace(/\..*$/, '').replace(/:/g, '').replace('T', '-')
export const dateSlugShort = (d?: Date) => (d || new Date()).toISOString().replace(/T.*$/, '')

export function mkdirp(dir: string)
{
	if (!fs.existsSync(dir))
		fs.mkdirSync(dir, { recursive: true })
}

export function cleanupDir(dir: string)
{
	if (fs.existsSync(dir))
		fs.rmSync(dir, { recursive: true })

	mkdirp(dir)
}
export function copyRecursive(src: string, dst: string)
{
	const files = fs.readdirSync(src, { withFileTypes: true })
	for (const file of files)
	{
		let from = path.join(src, file.name)
		let to = path.join(dst, file.name)
		if (file.isFile())
			fs.copyFileSync(from, to)
		else if (file.isDirectory())
			copyRecursive(from, to)
	}
}

export async function askQuestion(query: string)
{
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    })

    return new Promise<string>(resolve =>
	{
		rl.question(query, ans =>
		{
			rl.close()
			resolve(ans)
		})
	})
}

export function inspect(obj: any)
{
	if (typeof obj == "string")
		return obj
	
	return util.inspect(obj)
}
