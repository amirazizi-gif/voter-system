'use client'

import { Voter, calculateAge } from '@/lib/supabase'
import { useMemo } from 'react'

interface AnalyticsProps {
  voters: Voter[]
  totalVoters: number
}

export default function PredictiveAnalytics({ voters, totalVoters }: AnalyticsProps) {
  const analytics = useMemo(() => {
    if (voters.length === 0) return null

    // Basic counts
    const totalTagged = voters.filter(v => v.tag).length
    const yesCount = voters.filter(v => v.tag === 'Yes').length
    const unsureCount = voters.filter(v => v.tag === 'Unsure').length
    const noCount = voters.filter(v => v.tag === 'No').length
    const untaggedCount = voters.length - totalTagged

    // Percentages
    const taggedPercentage = (totalTagged / voters.length) * 100
    const yesPercentage = totalTagged > 0 ? (yesCount / totalTagged) * 100 : 0
    const unsurePercentage = totalTagged > 0 ? (unsureCount / totalTagged) * 100 : 0
    const noPercentage = totalTagged > 0 ? (noCount / totalTagged) * 100 : 0

    // PREDICTION 1: Projected Final Vote Count
    // Based on current tagging patterns
    const projectedYes = totalVoters * (yesPercentage / 100)
    const projectedUnsure = totalVoters * (unsurePercentage / 100)
    const projectedNo = totalVoters * (noPercentage / 100)

    // Optimistic: Assume 70% of "Unsure" will vote "Yes"
    const optimisticProjection = projectedYes + (projectedUnsure * 0.7)
    
    // Realistic: Assume 40% of "Unsure" will vote "Yes"
    const realisticProjection = projectedYes + (projectedUnsure * 0.4)
    
    // Pessimistic: Assume only 20% of "Unsure" will vote "Yes"
    const pessimisticProjection = projectedYes + (projectedUnsure * 0.2)

    // PREDICTION 2: Support by Age Group
    const ageGroups = {
      '18-30': voters.filter(v => { const age = calculateAge(v.tahun_lahir); return age >= 18 && age <= 30 }),
      '31-40': voters.filter(v => { const age = calculateAge(v.tahun_lahir); return age >= 31 && age <= 40 }),
      '41-55': voters.filter(v => { const age = calculateAge(v.tahun_lahir); return age >= 41 && age <= 55 }),
      '56+': voters.filter(v => { const age = calculateAge(v.tahun_lahir); return age >= 56 })
    }

    const ageGroupSupport = Object.entries(ageGroups).map(([group, groupVoters]) => {
      const groupYes = groupVoters.filter(v => v.tag === 'Yes').length
      const groupTagged = groupVoters.filter(v => v.tag).length
      return {
        group,
        total: groupVoters.length,
        yesCount: groupYes,
        supportRate: groupTagged > 0 ? (groupYes / groupTagged) * 100 : 0,
        taggedRate: (groupTagged / groupVoters.length) * 100
      }
    })

    // PREDICTION 3: Support by Gender
    const maleVoters = voters.filter(v => v.jantina === 'L')
    const femaleVoters = voters.filter(v => v.jantina === 'P')
    
    const maleSupport = maleVoters.filter(v => v.tag === 'Yes').length
    const femaleSupport = femaleVoters.filter(v => v.tag === 'Yes').length
    const maleTagged = maleVoters.filter(v => v.tag).length
    const femaleTagged = femaleVoters.filter(v => v.tag).length

    // PREDICTION 4: Support by Area (Top 5 best performing)
    const areaSupport = voters.reduce((acc, voter) => {
      const area = voter.daerah_mengundi
      if (!acc[area]) {
        acc[area] = { total: 0, yes: 0, tagged: 0 }
      }
      acc[area].total++
      if (voter.tag === 'Yes') acc[area].yes++
      if (voter.tag) acc[area].tagged++
      return acc
    }, {} as Record<string, { total: number, yes: number, tagged: number }>)

    const areaStats = Object.entries(areaSupport)
      .map(([area, stats]) => ({
        area,
        total: stats.total,
        yesCount: stats.yes,
        supportRate: stats.tagged > 0 ? (stats.yes / stats.tagged) * 100 : 0,
        taggedRate: (stats.tagged / stats.total) * 100
      }))
      .sort((a, b) => b.supportRate - a.supportRate)
      .slice(0, 5)

    // PREDICTION 5: Completion Rate & Projection
    const completionRate = (totalTagged / voters.length) * 100
    const remainingVoters = voters.length - totalTagged
    
    // Estimate remaining time based on current tagging rate
    // Assume current pattern continues
    const estimatedRemainingYes = remainingVoters * (yesPercentage / 100)
    const estimatedRemainingNo = remainingVoters * (noPercentage / 100)

    // PREDICTION 6: Target Achievement
    // Common targets: 50%, 55%, 60% support
    const targets = [50, 55, 60]
    const targetAchievement = targets.map(target => {
      const needed = (totalVoters * target / 100) - projectedYes
      const remainingUnsure = projectedUnsure
      const conversionNeeded = remainingUnsure > 0 ? (needed / remainingUnsure) * 100 : 0
      
      return {
        target,
        needed: Math.ceil(needed),
        currentGap: needed > 0 ? needed : 0,
        conversionNeeded: Math.min(conversionNeeded, 100),
        achievable: conversionNeeded <= 100 && needed > 0
      }
    })

    return {
      taggedPercentage,
      yesPercentage,
      unsurePercentage,
      noPercentage,
      projectedYes,
      projectedUnsure,
      projectedNo,
      optimisticProjection,
      realisticProjection,
      pessimisticProjection,
      ageGroupSupport,
      maleSupport: maleTagged > 0 ? (maleSupport / maleTagged) * 100 : 0,
      femaleSupport: femaleTagged > 0 ? (femaleSupport / femaleTagged) * 100 : 0,
      areaStats,
      completionRate,
      remainingVoters,
      estimatedRemainingYes,
      estimatedRemainingNo,
      targetAchievement,
      totalTagged,
      yesCount,
      unsureCount,
      noCount,
      untaggedCount
    }
  }, [voters, totalVoters])

  if (!analytics) {
    return (
      <div className="card mb-6">
        <h2 className="text-xl font-bold mb-4">📈 Predictive Analytics</h2>
        <p className="text-gray-500">No data available for analysis</p>
      </div>
    )
  }

  const getProjectionColor = (value: number) => {
    if (value >= totalVoters * 0.55) return 'text-green-600'
    if (value >= totalVoters * 0.50) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4 flex items-center">
          <span className="mr-2">📊</span>
          Tagging Progress
        </h2>
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span>Completion: {analytics.completionRate.toFixed(1)}%</span>
            <span>{analytics.totalTagged.toLocaleString()} / {voters.length.toLocaleString()} tagged</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div 
              className="bg-blue-600 h-4 rounded-full transition-all duration-300"
              style={{ width: `${analytics.completionRate}%` }}
            />
          </div>
          {analytics.remainingVoters > 0 && (
            <p className="text-sm text-gray-600 mt-2">
              {analytics.remainingVoters.toLocaleString()} voters remaining to tag
            </p>
          )}
        </div>
      </div>

      {/* Vote Projections */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4 flex items-center">
          <span className="mr-2">🎯</span>
          Vote Projections (Full Dataset)
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <div className="text-sm text-green-700 mb-1">Optimistic (70% Unsure → Yes)</div>
            <div className={`text-3xl font-bold ${getProjectionColor(analytics.optimisticProjection)}`}>
              {analytics.optimisticProjection.toFixed(0)}
            </div>
            <div className="text-sm text-gray-600">
              {((analytics.optimisticProjection / totalVoters) * 100).toFixed(1)}% of total
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="text-sm text-blue-700 mb-1">Realistic (40% Unsure → Yes)</div>
            <div className={`text-3xl font-bold ${getProjectionColor(analytics.realisticProjection)}`}>
              {analytics.realisticProjection.toFixed(0)}
            </div>
            <div className="text-sm text-gray-600">
              {((analytics.realisticProjection / totalVoters) * 100).toFixed(1)}% of total
            </div>
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <div className="text-sm text-yellow-700 mb-1">Pessimistic (20% Unsure → Yes)</div>
            <div className={`text-3xl font-bold ${getProjectionColor(analytics.pessimisticProjection)}`}>
              {analytics.pessimisticProjection.toFixed(0)}
            </div>
            <div className="text-sm text-gray-600">
              {((analytics.pessimisticProjection / totalVoters) * 100).toFixed(1)}% of total
            </div>
          </div>
        </div>

        <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
          <strong>Current Status:</strong> {analytics.yesCount.toLocaleString()} Yes, {analytics.unsureCount.toLocaleString()} Unsure, {analytics.noCount.toLocaleString()} No
        </div>
      </div>

      {/* Target Achievement */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4 flex items-center">
          <span className="mr-2">🎪</span>
          Target Achievement Analysis
        </h2>
        
        <div className="space-y-3">
          {analytics.targetAchievement.map((target) => (
            <div key={target.target} className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <span className="font-bold text-lg">{target.target}% Target</span>
                  <span className="text-gray-600 ml-2">
                    ({(totalVoters * target.target / 100).toFixed(0)} votes needed)
                  </span>
                </div>
                {target.achievable ? (
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                    Achievable ✓
                  </span>
                ) : target.currentGap <= 0 ? (
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    Achieved ✓
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                    Challenging
                  </span>
                )}
              </div>
              
              {target.currentGap > 0 ? (
                <div className="text-sm text-gray-600">
                  Need {target.needed.toLocaleString()} more "Yes" votes • 
                  Requires {target.conversionNeeded.toFixed(0)}% of "Unsure" voters
                </div>
              ) : (
                <div className="text-sm text-green-600 font-medium">
                  Target already projected to be achieved! 🎉
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Demographics Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Age Groups */}
        <div className="card">
          <h3 className="text-lg font-bold mb-4">📅 Support by Age Group</h3>
          <div className="space-y-3">
            {analytics.ageGroupSupport.map((group) => (
              <div key={group.group} className="border-l-4 border-blue-500 pl-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium">{group.group} years</span>
                  <span className="text-sm text-gray-600">
                    {group.yesCount} / {group.total}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${group.supportRate}%` }}
                  />
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {group.supportRate.toFixed(1)}% support rate • {group.taggedRate.toFixed(0)}% tagged
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gender */}
        <div className="card">
          <h3 className="text-lg font-bold mb-4">👥 Support by Gender</h3>
          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-3">
              <div className="flex justify-between items-center mb-1">
                <span className="font-medium">Male (Lelaki)</span>
                <span className="text-lg font-bold text-blue-600">
                  {analytics.maleSupport.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${analytics.maleSupport}%` }}
                />
              </div>
            </div>

            <div className="border-l-4 border-pink-500 pl-3">
              <div className="flex justify-between items-center mb-1">
                <span className="font-medium">Female (Perempuan)</span>
                <span className="text-lg font-bold text-pink-600">
                  {analytics.femaleSupport.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-pink-600 h-2 rounded-full"
                  style={{ width: `${analytics.femaleSupport}%` }}
                />
              </div>
            </div>

            {Math.abs(analytics.maleSupport - analytics.femaleSupport) > 5 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
                <strong>📌 Insight:</strong> {analytics.maleSupport > analytics.femaleSupport ? 'Male' : 'Female'} voters 
                show {Math.abs(analytics.maleSupport - analytics.femaleSupport).toFixed(1)}% higher support rate
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Performing Areas */}
      <div className="card">
        <h3 className="text-lg font-bold mb-4">🏆 Top 5 Performing Areas</h3>
        <div className="space-y-2">
          {analytics.areaStats.map((area, index) => (
            <div key={area.area} className="flex items-center gap-3 p-3 bg-gray-50 rounded">
              <div className="text-2xl font-bold text-gray-400 w-8">
                #{index + 1}
              </div>
              <div className="flex-1">
                <div className="font-medium">{area.area}</div>
                <div className="text-xs text-gray-600">
                  {area.yesCount} Yes votes • {area.total} total voters • {area.taggedRate.toFixed(0)}% tagged
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-green-600">
                  {area.supportRate.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-600">support</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Key Insights */}
      <div className="card bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
        <h3 className="text-lg font-bold mb-4 text-blue-900">💡 Key Insights & Recommendations</h3>
        <ul className="space-y-2 text-sm">
          {analytics.completionRate < 50 && (
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>Only {analytics.completionRate.toFixed(0)}% of voters are tagged. Focus on increasing tagging coverage for more accurate predictions.</span>
            </li>
          )}
          
          {analytics.unsureCount > analytics.yesCount * 0.3 && (
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>High number of "Unsure" voters ({analytics.unsureCount.toLocaleString()}). These are your persuadable voters - prioritize outreach to this group.</span>
            </li>
          )}

          {analytics.ageGroupSupport.some(g => g.supportRate < 40) && (
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>Some age groups show lower support rates. Consider targeted campaigns for these demographics.</span>
            </li>
          )}

          {Math.abs(analytics.maleSupport - analytics.femaleSupport) > 10 && (
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>Significant gender gap detected. Design gender-specific messaging to address the lower-performing demographic.</span>
            </li>
          )}

          {analytics.realisticProjection < totalVoters * 0.5 && (
            <li className="flex items-start gap-2">
              <span className="text-red-600 font-bold">•</span>
              <span className="text-red-700 font-medium">⚠️ Current trajectory suggests less than 50% support. Immediate action needed to shift momentum.</span>
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}