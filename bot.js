//https://discordapp.com/oauth2/authorize?&client_id=502619724421529608&scope=bot&permissions=8
//Requires
const cfg = require("./botcfg.json");
const Discord = require('discord.js');
const YTDL = require('ytdl-core');
const Youtube = require('simple-youtube-api');
const request = require('request');

//Bot cfg
const prefix = cfg.prefix;
const token = cfg.token;
const ytKey = cfg.yt_key;
const steamKey = cfg.steam_key;
const botID = cfg.botDiscordID;

//APIs
const client = new Discord.Client();
const yt = new Youtube(ytKey);

//Variables
let isPlaying = false; //check if the bot is playing
let fromSkip = false; //check if the end song function is called by the skip command
let search = false; //check if the music added isn't a link
let csMode = false;
let conn; //saves the bot connection to the VoiceChannel
let songs; //saves the results of the search
let searchTimer; //saves the setTimeout of the search to be deleted
let discTimer; //saves the setTimeout of the disconnect to be deleted
let csTimer; //saves the setInterval of the csMode to be deleted
let steamIDs = []; //saves the steam ID of who's in the VoiceChannel
let queuePages = [];
let totalPages; //saves the number of pages in the queue embed
let currentPage = 1; //the page the user is in the queue
let server =
{
	queue: [],
	musicName: [],
	nickname: [],
	username: [],
	promises: []
}

//checks if the input is an url
function isURL(str)
{
	var pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
	  '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
	  '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
	  '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
	  '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
	  '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
	return !!pattern.test(str);
}

//returns all the users there are in the same voiceChannel as the bot
function getBotVoiceChannel()
{
	let arr = client.channels.array();//get all channels on the server
	for (let i = 0; i < arr.length; i++)//cycle through each channel
	{
		if (arr[i].type == "voice")//checks if it is a voiceChannel
		{
			let members = arr[i].members.array();//get the users in the voiceChannel
			if (members.length >= 1)//checks if the voiceChannel has more the one user connected
			{
				for (let j = 0; j < members.length; j++)//cycle through each user in the voiceChannel
				{
					if (members[j].user.id == botID)//check if one of the users in the voiceChannel is bot
					{
						return members;//returns all the users there are in the same voiceChannel as the bot
					}
				}
			}
		}
	}
	return undefined;
}

//shuffle the queue
function suffle()
{
	for (let i = server.queue.length - 1 ; i > 0; i--)
	{
		let index = Math.floor((Math.random() * (i - 1)) + 1);//random index
		//temporary variables to save the current server[i]
		let tempQ = server.queue[i];
		let tempN = server.nickname[i];
		let tempU = server.username[i];
		let tempP = server.promises[i];
		let tempM = server.musicName[i];

		//swaps the server[i] for server[index]
		server.queue[i] = server.queue[index];
		server.nickname[i] = server.nickname[index];
		server.username[i] = server.username[index];
		server.promises[i] = server.promises[index];
		server.musicName[i] = server.musicName[index];

		//swaps the server[index] for server[i](temporary)
		server.queue[index] = tempQ;
		server.nickname[index] = tempN;
		server.username[index] = tempU;
		server.promises[index] = tempP;
		server.musicName[index] = tempM;
	}
}

//saves all the queue pages in the memory and shows the first one
function showQueue(msg)
{
	queuePages = [];//restart the pages of the queue
	currentPage = 1;//sets the current page the user is to 1

	let howMuch = 5;//how many thing per page
	//calculates how many pages will be needed
	totalPages = Math.floor((server.queue.length - 1) / howMuch);
	if ((server.queue.length - 1) % howMuch)
	{
		totalPages++;
	}
	let iterations = 1;//counts in which page the saving it is
	for (let i = 0; i < totalPages; i++)
	{
		let count = 1;//counts in which song per page it is
		//embed things
		let embed = new Discord.RichEmbed();
		embed.setTitle("Fila:");
		embed.setDescription(`Número de músicas na fila: **${server.queue.length - 1}** | **${prefix}fila <número da música>** para seleciona-la.`);
		embed.setColor([221, 76, 7]);
		embed.addField(`Modo CS: **${csMode ? "ativado" : "desativado"}**.`, `**${prefix}cs** <**0**-off|**1**-on>.`);
		embed.setFooter(`Página ${i+1} de ${totalPages}.`);
		Promise.all(server.promises)
			.then(info => {
				for (let j = 1 + ((iterations - 1) * howMuch); j < server.queue.length; j++)
				{
					if (count > howMuch)//if hitted 5 per page break
					{
						iterations++;
						break;
					}
					let desc = `Adicionado por: **${server.username[j]}**.`;//description for the embed fild
					embed.addField(`${j}. __**${server.musicName[j]}**__.`, desc);//embed fild for the songs
					count++;
				}
				queuePages.push(embed);//saves the embed
				
				if (i == 0)
				{
					msg.channel.send(queuePages[0]);//send the first embed
				}
			})
			.catch(err => console.error(err));
	}
}

//deletes the server[0]
function arrayShift()
{
	server.queue.shift();
	server.nickname.shift();
	server.username.shift();
	server.promises.shift();
	server.musicName.shift();
}

//add the music to the queue
function add(link, msg, check = true)
{
	server.queue.push(link);
	server.nickname.push(msg.member.nickname);
	server.username.push(msg.author.username);
	if (check)//checks if is need to push the promises and name of the song
	{	
		server.promises.push(YTDL.getInfo(link, (err, info) => {
			if (err)
			{
				console.error(err);
				return;
			}
			server.musicName.push(info.title);
			{
				//embed saying the music was added
				let embed = new Discord.RichEmbed();
				embed.setTitle(`Música adicionada:`);
				embed.setDescription(`Modo CS: **${csMode ? "ativado" : "desativado"}**.`);
				embed.setColor([221, 76, 7]);
				let desc = `Adicionado por: **${server.username[server.queue.length - 1]}**.`;
				embed.addField(`Adicionado com sucesso: **${info.title}**.`, desc);
				msg.channel.send(embed);
			}
		}));
	}
}

//makes the bot join in the VoiceChannel
function join(msg, check = false, len = -1)
{
	if (msg.member.voiceChannel)//checks if the user who sent the message it is in a voice channel
	{
		msg.member.voiceChannel.join()
		.then(connection => {
			conn = connection;
			if (check)//checks if the join came from the playlist
			{
				if (!isPlaying && server.queue.length == len)//start to play if the queue lenght is iqual to the playlist length and is not playing
				{
					clearTimeout(discTimer);//stops the auto disconnection
					play(connection, msg);
				}
			}
			else if (server.queue.length == 1)//just call the play function one time if already have one music on the server
			{
				clearTimeout(discTimer);//stops the auto disconnection
				play(connection, msg);
			}
		})
		.catch(err => console.error(err));
	}
}

//check if all the search results are videos
function checkSearchResults()
{
	for (let i = 0; i < songs.length; i++)
	{
		if (songs[i].type == "channel")//remove the channels from the search
		{
			songs.splice(i, 1);
			checkSearchResults();
		}
	}
	return true;
}

//play the music and check the ends of the music
function play(connection, msg)
{	
	//play part
	if (!isPlaying)
	{		
		server.dispatcher = connection.playStream(YTDL(server.queue[0], {filter: "audioonly"}));
		isPlaying = true;
	}

	//end song part
	server.dispatcher.on("end", () => {
		if (!fromSkip)
		{
			isPlaying = false;
			arrayShift();
			if (server.queue[0])//checks if have a song on the queue
			{
				play(connection, msg);
			}
			else
			{
				//auto disconnection: 1hr timeout
				discTimer = setTimeout(() => {
					if (msg.guild.voiceConnection) 
					{
						msg.guild.voiceConnection.disconnect();
					}
				}, 1000 * 60 * 60);
			}
		}
	});
}

//checks if the user who sent the message it is in the same voice channel as the bot
function sameVoiceChannel(msg)
{
	let membersOnTheVoice = getBotVoiceChannel();
	for (let i = 0; i < membersOnTheVoice.length; i++)
	{
		if (msg.author.username == membersOnTheVoice[i].user.username) 
		{
			return true;
		}
	}
	return false;
}

//check if the bot is ready
client.on('ready', () => {
	console.log("Started!!");
})

client.on('message', msg => {
	if (!msg.author.equals(client.user))//check if the user who sent the message is not the bot
	{			
		

		if (msg.content.startsWith(prefix))
		{
			
			let cont = msg.content.split(" ");//split the content by spaces
			while (cont[1] == '') //remove all the blanks spaces between the cont[0] and cont[1]
			{
				cont.splice(1, 1);
			}

			//pick a result of the search
			if (search)
			{
				if (cont[0].toLowerCase() == `${prefix}play`)
				{
					if (isNaN(cont[1]))
					{
						msg.channel.send("Valor inserido não é um número.");
						return;
					}
					if (cont[1] > songs.length || cont[1] < 1)
					{
						msg.channel.send(`Valor inserido deve estar entre 1 e ${songs.length}.`);
						return;
					}
					server.promises.push(songs[cont[1] - 1]);
					server.musicName.push(songs[cont[1] - 1].title);
					let link = `https://www.youtube.com/watch?v=${songs[cont[1] - 1].id}`;
					add(link, msg, false);
					join(msg);
					{
						let embed = new Discord.RichEmbed();
						embed.setTitle(`Música adicionada:`);
						embed.setDescription(`Modo CS: **${csMode ? "ativado" : "desativado"}**.`);
						embed.setColor([221, 76, 7]);
						let desc = `Adicionado por: **${server.username[server.queue.length - 1]}**.`;
						embed.addField(`**#${cont[1]}** Adicionado com sucesso: **${songs[cont[1] - 1].title}**.`, desc);
						msg.channel.send(embed);
					}
					search = false;
					clearTimeout(searchTimer);
					return;
				}
				else if (cont[0].toLowerCase() == `${prefix}cancel`)
				{
					msg.channel.send("Seleção descontinuada.");
					search = false;
					clearTimeout(searchTimer);
					return;
				}
				else
				{
					msg.channel.send(`Ops não entendi, como usar: **${prefix}play <número da opção>**.`);
					return;
				}
			}

			//commands
			switch (cont[0].toLowerCase())
			{
				case `${prefix}play`:
					if (!msg.member.voiceChannel)
					{
						msg.reply("Você precisa estar em um canal.");
						return;
					}
					if (!cont[1])
					{
						msg.channel.send("Sem o que buscar, favor prover um link ou um nome.");
						return;
					}

					if (isURL(cont[1]))
					{
						//play with a link
						if (YTDL.validateURL(cont[1]))
						{
							//checks if the link is from a playlist
							if (cont[1].includes("list="))
							{			
								yt.getPlaylist(cont[1])
									.then(playlist => {
										return playlist.getVideos();
									})
									.then(videos => {
										for (let i = 0; i < videos.length; i++)
										{
											server.promises.push(videos[i]);
											server.musicName.push(videos[i].title);
											let link = `https://www.youtube.com/watch?v=${videos[i].id}`;
											add(link, msg, false);
										}
										{
											let embed = new Discord.RichEmbed();
											embed.setTitle(`Músicas da playlist adicionadas:`);
											embed.setDescription(`Modo CS: **${csMode ? "ativado" : "desativado"}**.`);
											embed.setColor([221, 76, 7]);
											let desc = `Adicionadas por: **${msg.author.username}**.`;
											embed.addField(`**${videos.length}** músicas adicionadas com sucesso.`, desc);
											msg.channel.send(embed);
										}
										join(msg, true, videos.length);
									})
									.catch(err => {
										msg.channel.send("Link invalido, favor verificar.");
									});
									return;
							}
							else //normal links
							{
								add(cont[1], msg);
								join(msg);
							}
						}
						else
						{
							msg.channel.send("Link invalido, favor verificar.");
							return;
						}
					}
					else
					{
						//makes the search
						let str = "";
						for (let i = 1; i < cont.length; i++)
						{
							str += cont[i];
							if (i < cont.length - 1)
							{
								str += " ";
							}
						}
						yt.searchVideos(str, 5)
							.then(results => {
								songs = results;
								let embed = new Discord.RichEmbed();
								embed.setTitle(`Opções:`);
								embed.setDescription(`Como usar: **${prefix}play <número da opção>** | Para cancelar(depois de 1min a seleção será cancelada): **${prefix}cancel** .`);
								embed.setColor([221, 76, 7]);
								if (checkSearchResults()) 
								{
									for (let i = 0; i < songs.length; i++)
									{
										embed.addField(`${i+1}. __**${songs[i].title}**__.`, `Canal: **${songs[i].raw.snippet.channelTitle}**.`);
									}
								}
								msg.channel.send(embed);
								searchTimer = setTimeout(() => {
									if (search)
									{		
										search = false;
										msg.channel.send("Seleção descontinuada.");
									}
								}, 1000 * 60);
								search = true;
							})
							.catch(err => {
								console.error(err);
								msg.channel.send("Nenhum video encontrado.");
							});
					}

					break;

				case `${prefix}stop`:
					if (msg.guild.voiceConnection) 
					{
						if (sameVoiceChannel(msg))
						{
							//stop
							fromSkip = false;
							isPlaying = false;
							csMode = false;
							clearTimeout(discTimer);
							clearTimeout(searchTimer);
							clearInterval(csTimer);
							msg.guild.voiceConnection.disconnect();
							//clear the server
							let len = server.queue.length;
							for (let i = 0; i < len; i++) 
							{
								arrayShift();
							}
							queuePages = [];
							
							msg.channel.send(`Música parada, modo CS **desativado** e fila esvaziada: **${len}** músicas removidas.`);
							return;
						}
						else
						{
							msg.channel.send(`Você deve estar no mesmo canal de voz que eu para me parar.`);
							return;
						}
					}
					else
					{
						msg.channel.send(`Não estou conectado a nenhuma sala para parar de tocar.`);
					}
					break;

				case `${prefix}pause`:
					if (server.queue.length == 0 || !isPlaying)
					{
						msg.channel.send("Não há nada tocando.");
						return;
					}
					if (sameVoiceChannel(msg))
					{						
						//pause
						isPlaying = false;
						server.dispatcher.pause();
						msg.channel.send(`Musica interrompida: **${server.musicName[0]}**.`);
						return;
					}
					else
					{
						msg.channel.send(`Você deve estar no mesmo canal de voz que eu para interromper a música.`);
					}
					break;

				case `${prefix}resume`:
					if (server.queue.length == 0 || isPlaying)
					{
						msg.channel.send("Não há nenhuma música interrompida.");
						return;
					}
					if (sameVoiceChannel(msg))
					{
						//resume
						isPlaying = true;
						server.dispatcher.resume();	
						msg.channel.send(`Musica continuada: **${server.musicName[0]}**.`);
						return
					}
					else
					{
						msg.channel.send(`Você deve estar no mesmo canal de voz que eu para continuar a música.`);
					}
					break;

				case `${prefix}skip`:
					if (server.queue.length <= 1)
					{
						msg.channel.send("Não há nenhuma música na fila.");
						return;
					}
					if (sameVoiceChannel(msg))
					{
						//checks if the user wants to skip multiple songs
						if (cont[1])
						{
							if (isNaN(cont[1]))
							{
								msg.channel.send("Valor inserido não é um número.");
								return;
							}
							if (cont[1] >= server.queue.length)
							{
								msg.channel.send("Valor inserido deve ser menor do que o tamanho da fila.");
								return;
							}
							for (let i = 0; i < cont[1]; i++)
							{
								arrayShift();
							}
						}
						else
						{
							//just skip one music
							arrayShift();
						}

						if (!isPlaying)//this fix a bug
						{
							isPlaying = true;
							server.dispatcher.resume();
						}

						//starts the next song
						fromSkip = true;
						isPlaying = false;
						play(conn, msg);
						msg.channel.send(`Música pulada, tocando agora **${server.musicName[0]}**.`);
						fromSkip = false;
						return;
					}
					else
					{
						msg.channel.send(`Você deve estar no mesmo canal de voz que eu para pular a música.`);
					}
					break;

				case `${prefix}fila`:
					//checks if the user want to choose a song of the queue
					if (cont[1]) 
					{
						if (isNaN(cont[1]))
						{
							msg.channel.send("Valor inserido não é um número.");
							return;
						}
						if (cont[1] == 0) 
						{
							msg.channel.send(`O valor inserido deve estar entre 1 e ${server.queue.length - 1}.`);
							return;
						}
						if (server.queue.length == 1 || server.queue.length == 0)
						{
							msg.channel.send("Não há nenhuma música na fila para ser escolhida.");
							return;
						}

						if (sameVoiceChannel(msg))
						{
							if (cont[1] > server.queue.length)
							{
								if (server.queue.length == 2)
								{
									msg.channel.send("Há apenas uma música na fila.");
									return;
								}
								msg.channel.send(`O valor inserido deve estar entre 1 e ${server.queue.length - 1}.`);
								return;
							}
							//change the server state part
							server.queue[0] = server.queue[cont[1]];
							server.username[0] = server.username[cont[1]];
							server.nickname[0] = server.nickname[cont[1]];
							server.promises[0] = server.promises[cont[1]];
							server.musicName[0] = server.musicName[cont[1]];
	
							server.queue.splice(cont[1], 1);
							server.username.splice(cont[1], 1);
							server.nickname.splice(cont[1], 1);
							server.promises.splice(cont[1], 1);
							server.musicName.splice(cont[1], 1);

							if (!isPlaying)//this fix a bug
							{
								isPlaying = true;
								server.dispatcher.resume();
							}

							//play part
							fromSkip = true;
							isPlaying = false;
							play(conn, msg);
							msg.channel.send(`Música pulada, tocando agora __**${server.musicName[0]}**__.`);
							fromSkip = false;
							return;
						}
						else
						{
							msg.channel.send(`Você deve estar no mesmo canal de voz que eu para selecionar a música.`);
							return;
						}
					}

					//just show the queue
					if (server.queue.length <= 1)
					{
						msg.channel.send("Não há nenhuma música na fila.");
						return;
					}
					showQueue(msg);
					break;

				case `${prefix}misturar`:
					
					if (server.queue.length <= 1)
					{
						msg.channel.send("Não há nenhuma música na fila.");
						return;
					}
					if (sameVoiceChannel(msg))
					{
						suffle();
						showQueue(msg);
						return;
					}
					else
					{
						msg.channel.send(`Você deve estar no mesmo canal de voz que eu para misturar as músicas.`);
					}
					break;
				
				case `${prefix}np`:
					if (server.queue.length == 0)
					{
						msg.channel.send("Não há nada tocando.");
						return;
					}

					{
						let embed = new Discord.RichEmbed();
						embed.setTitle(`Tocando:`);
						embed.setColor([221, 76, 7]);
						let desc = `Adicionado por: **${server.username[0]}**.`;
						embed.addField(`**${server.musicName[0]}**.`, desc);
						msg.channel.send(embed);
					}
					break;

				case `${prefix}cancel`:
					msg.channel.send(`O comando **${prefix}cancel** so esta disponivel na seleção de músicas.`);
					break;

				case `${prefix}cs`:
				{
					if (!cont[1])
					{
						{
							let embed = new Discord.RichEmbed();
							embed.setTitle(`Modo CS:`);
							embed.setColor([221, 76, 7]);
							embed.addField(`Está **${csMode ? "ativado" : "desativado"}**.`, `Como usar: **${prefix}cs**  **0** - desativar | **1** - ativar.`);
							msg.channel.send(embed);
						}
						return;
					}
					if (cont[1] != "0" && cont[1] != "1")
					{
						msg.channel.send("O valor inserido dever ser **0** - desativar | **1** - ativar.");
						return;
					}
					if (cont[1] == "0")
					{
						csMode = false;
						msg.channel.send("O modo CS foi **desativado**.");
						clearInterval(csTimer);
						return;
					}
					if (cont[1] == "1")
					{
						if (csMode)
						{
							msg.channel.send("O modo CS já está **ativado**.");
							return;
						}
						csMode = true;
						msg.channel.send("O modo CS foi **ativado**.");
						//Creates a interval of 10sec
						csTimer = setInterval(() => {
							if (isPlaying)
							{
								let members = getBotVoiceChannel()
								if (!members)
								{
									return;
								}
								for (let i = 0; i < members.length; i++)
								{
									//Get the steam id of each user in the voice channel
									switch (members[i].user.username) {
										case "gb09":
											steamIDs.push(cfg.jorgeID);
											break;
										case "japa":
											steamIDs.push(cfg.japaID);
											break;
										case "MuriloDorta":
											steamIDs.push(cfg.muriloID);
											break;
										case "Magliano":
											steamIDs.push(cfg.pedroID);
											break;
										case "Jack Frost":
											steamIDs.push(cfg.brunoID);
											break;
										case "henrique almeida":
											steamIDs.push(cfg.almeidaID);
											break;
										case "Higuchi":
											steamIDs.push(cfg.daviID);
											break;
										case "Hugo":
											steamIDs.push(cfg.hugoID);
											break;
										case "Dekihi":
											steamIDs.push(cfg.viniID);
											break;
										default:
											break;
									}
								}
								//run through each id in the VoiceChannel and check if the user is playing CS:GO
								for (let i = 0; i < steamIDs.length; i++)
								{
									let steamAPI = `http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${steamKey}&steamids=${steamIDs[i]}`;
									request(steamAPI, { json: true }, (err, res, body) => {
										if (err)
										{
											return console.error(err);
										}
										if (body.response.players[0].gameid)
										{
											if (body.response.players[0].gameid == "730")
											{
												if (isPlaying)
												{
													isPlaying = false;
													server.dispatcher.pause();
													msg.channel.send(`Musica interrompida (devido ao **modo CS**): **${server.musicName[0]}**.`);
												}
											}
										}
										steamIDs.shift();
									});
								}
							}
						}, 1000 * 10);
					}
					break;
				}

				case `${prefix}help`:
					{
						let embed = new Discord.RichEmbed();
						embed.setTitle(`Ajuda:`);
						embed.setColor([221, 76, 7]);
						embed.addField(`${prefix}cs:`, `Como usar: **${prefix}cs** | **${prefix}cs <0-off|1-on>**.`);
						embed.addField(`${prefix}play:`, `Como usar: **${prefix}play <link/nome>**.`);
						embed.addField(`${prefix}stop:`, `Como usar: **${prefix}stop**.`);
						embed.addField(`${prefix}cancel:`, `Como usar: **${prefix}cancel**.`);
						embed.addField(`${prefix}resume:`, `Como usar: **${prefix}resume**.`);
						embed.addField(`${prefix}pause:`, `Como usar: **${prefix}pause**.`);
						embed.addField(`${prefix}fila:`, `Como usar: **${prefix}fila** | **${prefix}fila <número da música>** para seleciona-la.`);
						embed.addField(`${prefix}misturar:`, `Como usar: **${prefix}misturar**.`);
						embed.addField(`${prefix}skip:`, `Como usar: **${prefix}skip <número de músicas a serem puladas(contando com a atual)>**.`);
						msg.channel.send(embed);
					}
					break;
					
				default:
					msg.channel.send(`Comando inválido | **${prefix}help** para mais ajuda.`);
					break;
			}
		}
	}
	else
	{
		if (msg.embeds[0])
		{			
			if (msg.embeds[0].title == "Fila:")//adds the reaction to the queue to able the user go through tha pages
			{
				msg.react('⏪')//page down
					.then(r => {
						msg.react('⏩')//page up
					})
			}
		}
	}
});

//reaction added
client.on('messageReactionAdd', react => { 
	let arr = react.users.array();
	if (arr[0].id == botID)//check if the reaction came from the message of the bot
	{
		if (arr[1])//checks if reaction was made by a user
		{
			if (react.emoji.name == '⏩')//page up
			{
				if (currentPage == totalPages)
				{
					return;
				}
				currentPage++;
				react.message.edit(queuePages[currentPage - 1]);//edit the message
			}
			if (react.emoji.name == '⏪')//page down
			{
				if (currentPage == 1)
				{
					return;
				}
				currentPage--;
				react.message.edit(queuePages[currentPage - 1]);//edit the message
			}
		}
	}
});

//reaction removed
client.on('messageReactionRemove', react => { 
	//dont need to check if the reaction was made by a user

	let arr = react.users.array();
	if (arr[0].id == botID)//check if the reaction came from the message of the bot
	{
		if (react.emoji.name == '⏩')//page up
		{
			if (currentPage == totalPages) 
			{
				return;
			}
			currentPage++;
			react.message.edit(queuePages[currentPage - 1]);//edit the message
		}
		if (react.emoji.name == '⏪')//page down
		{
			if (currentPage == 1) 
			{
				return;
			}
			currentPage--;
			react.message.edit(queuePages[currentPage - 1]);//edit the message
		}
	}
});

client.login(token);
