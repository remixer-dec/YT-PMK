function getMyPlaylists() {
  return YouTube.Playlists.list(['id','snippet'], {mine: true, maxResults: 50})
}

function getPlaylists(ids) {
  return YouTube.Playlists.list(['id','snippet'], {id: ids, maxResults: 50})
}

function getPlaylistVideos(id) {
  let skip = 0 
  let total = 50
  let pageToken = false
  const results = {items: []}
  while (skip < total) {
    const params = {playlistId: id, maxResults: 50}
    if (pageToken) {
      params['pageToken'] = pageToken
    }
    const page = YouTube.PlaylistItems.list(['contentDetails', 'snippet', 'status'], params)
    skip += page.pageInfo.resultsPerPage
    total = page.pageInfo.totalResults
    pageToken = page.nextPageToken
    results.items.push(...page.items)
    console.log(`Fetching playlist details (${Math.min(skip, total)}/${total})`)
  }
  if (id === 'LL') results.items.reverse()
  return results
}

function getVideosWithFullMetadata(playlistItems) {
  const results = {items: []}
  while (playlistItems.length > 0) {
    let chunk = playlistItems.splice(0, 50)
    const ids = chunk.map(v => v.contentDetails ? v.contentDetails.videoId : v.id.videoId)
    let chunkData = YouTube.Videos.list(['contentDetails', 'snippet', 'status'], {id: ids.join(','), maxResults: 50}).items
    let allVideos = chunk.map(x => {
      const id = x.contentDetails ? x.contentDetails.videoId : x.id.videoId
      return chunkData.find(v => v.id === id) || {id, contentDetails: x.contentDetails || {duration: ''}, snippet: x.snippet, status: x.status}
    })
    results.items.push(...allVideos)
    console.log(`Fetching video details (${playlistItems.length} left)`)
  }
  return results
}

function getVideosFromSearch(query) {
  const results = YouTube.Search.list(['id', 'snippet'], {q: query, type: 'video', maxResults: 20});
  return getVideosWithFullMetadata(results.items).items
}

function deleteVideoFromPlaylist(playlistItemId) {
  YouTube.PlaylistItems.remove(playlistItemId)
}

function addVideoToPlaylist(videoId, playlistId, position) {
  YouTube.PlaylistItems.insert({snippet: {playlistId, resourceId: { kind: 'youtube#video', videoId }, position}}, ['snippet'])
}

function isRegionRestricted(video, countryCode) {
  if (video.contentDetails.regionRestriction) {
    if (video.contentDetails.regionRestriction.blocked) {
      const blocked = new Set(video.contentDetails.regionRestriction.blocked)
      if (blocked.has(countryCode.toUpperCase())) {
        return true
      }
    }
    if (video.contentDetails.regionRestriction.allowed) {
      const allowed = new Set(video.contentDetails.regionRestriction.allowed)
      if (!allowed.has(countryCode.toUpperCase())) {
        return true
      } 
    }
    return false
  } else {
    return false
  }
}