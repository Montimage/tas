import React from 'react';

import './Stats.css';

const Stats = ({
  stats
}) => {
  if (!stats) {
    return (<span className = "stats" > Loading... </span>);
  }
  return (
    <span className = "stats">
    {
      stats.isLoading && '🧐'
    }
    {
      stats.error && '😭'
    }
    {
      stats.downloads && `🥰 ${stats.downloads}`
    }
    </span>
  )
}

export default Stats;
